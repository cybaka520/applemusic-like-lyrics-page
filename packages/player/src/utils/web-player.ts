import { TypedEventTarget } from "./TypedEventTarget";

export interface WebPlayerEventMap {
	play: undefined;
	pause: undefined;
	ended: undefined;
	loaded: undefined;
	timeupdate: number;
	volumechange: number;
	seeked: number;
	error: Error;
}

export class WebPlayer extends TypedEventTarget<WebPlayerEventMap> {
	private audioContext: AudioContext;
	private audioElement: HTMLAudioElement;
	private sourceNode: MediaElementAudioSourceNode;
	private gainNode: GainNode;
	private currentObjectUrl: string | null = null;

	private targetVolume: number = 1.0;
	private readonly FADE_DURATION = 0.2;
	private fadeOutTimer: number | null = null;

	constructor() {
		super();
		this.audioContext = new AudioContext();
		this.audioElement = new Audio();
		this.audioElement.crossOrigin = "anonymous";

		this.sourceNode = this.audioContext.createMediaElementSource(
			this.audioElement,
		);
		this.gainNode = this.audioContext.createGain();

		this.sourceNode.connect(this.gainNode);
		this.gainNode.connect(this.audioContext.destination);

		this.bindEvents();
	}

	private bindEvents() {
		const simpleEvents = ["play", "pause", "ended"] as const;
		simpleEvents.forEach((evt) => {
			this.audioElement.addEventListener(evt, () => {
				this.emit(evt, undefined);
			});
		});

		this.audioElement.addEventListener("timeupdate", () => {
			this.emit("timeupdate", this.currentTime);
		});

		this.audioElement.addEventListener("seeked", () => {
			this.emit("seeked", this.currentTime);
		});

		this.audioElement.addEventListener("error", (e) => {
			console.error("WebPlayer Error:", e);
			const errorMsg =
				this.audioElement.error?.message || "Unknown Audio Error";
			this.emit("error", new Error(errorMsg));
		});
	}

	async load(audioFile: File) {
		if (this.currentObjectUrl) {
			URL.revokeObjectURL(this.currentObjectUrl);
		}

		this.currentObjectUrl = URL.createObjectURL(audioFile);
		this.audioElement.src = this.currentObjectUrl;

		this.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);

		return new Promise<void>((resolve, reject) => {
			const onCanPlay = () => {
				cleanup();
				this.emit("loaded", undefined);
				resolve();
			};
			const onError = (e: Event) => {
				cleanup();
				reject(e);
			};
			const cleanup = () => {
				this.audioElement.removeEventListener("canplay", onCanPlay);
				this.audioElement.removeEventListener("error", onError);
			};

			this.audioElement.addEventListener("canplay", onCanPlay);
			this.audioElement.addEventListener("error", onError);

			this.audioElement.load();
		});
	}

	async play() {
		this.emit("play", undefined);

		if (this.audioContext.state === "suspended") {
			await this.audioContext.resume();
		}

		if (this.fadeOutTimer) {
			clearTimeout(this.fadeOutTimer);
			this.fadeOutTimer = null;
		}

		try {
			const now = this.audioContext.currentTime;

			this.gainNode.gain.cancelScheduledValues(now);
			this.gainNode.gain.setValueAtTime(0, now);

			await this.audioElement.play();

			this.gainNode.gain.linearRampToValueAtTime(
				this.targetVolume,
				now + this.FADE_DURATION,
			);
		} catch (err) {
			console.error("播放失败", err);
			this.emit("pause", undefined);
		}
	}

	pause() {
		this.emit("pause", undefined);

		const now = this.audioContext.currentTime;
		this.gainNode.gain.cancelScheduledValues(now);
		this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
		this.gainNode.gain.linearRampToValueAtTime(0, now + this.FADE_DURATION);

		if (this.fadeOutTimer) clearTimeout(this.fadeOutTimer);

		this.fadeOutTimer = window.setTimeout(() => {
			this.audioElement.pause();
			this.fadeOutTimer = null;
		}, this.FADE_DURATION * 1000);
	}

	seek(time: number) {
		if (Number.isFinite(time)) {
			const duration = this.duration;

			const maxSeekTime = Math.max(0, duration - 0.5);

			this.audioElement.currentTime = Math.min(time, maxSeekTime);
		}
	}

	setVolume(volume: number) {
		this.targetVolume = volume;
		const now = this.audioContext.currentTime;

		if (!this.audioElement.paused && !this.fadeOutTimer) {
			this.gainNode.gain.cancelScheduledValues(now);
			this.gainNode.gain.setTargetAtTime(volume, now, 0.05);
		}
		this.emit("volumechange", volume);
	}

	get duration() {
		return Number.isNaN(this.audioElement.duration)
			? 0
			: this.audioElement.duration;
	}

	get currentTime() {
		return this.audioElement.currentTime;
	}

	getInternalSourceNode() {
		return this.sourceNode;
	}

	getInternalContext() {
		return this.audioContext;
	}
}

export const webPlayer = new WebPlayer();
