import {
	fftDataAtom,
	hideLyricViewAtom,
	isLyricPageOpenedAtom,
	isShuffleActiveAtom,
	musicArtistsAtom,
	musicCoverAtom,
	musicDurationAtom,
	musicIdAtom,
	musicLyricLinesAtom,
	musicNameAtom,
	musicPlayingAtom,
	musicPlayingPositionAtom,
	musicQualityTagAtom,
	musicVolumeAtom,
	onChangeVolumeAtom,
	onClickControlThumbAtom,
	onCycleRepeatModeAtom,
	onLyricLineClickAtom,
	onPlayOrResumeAtom,
	onRequestNextSongAtom,
	onRequestOpenMenuAtom,
	onRequestPrevSongAtom,
	onSeekPositionAtom,
	onToggleShuffleAtom,
	RepeatMode,
	repeatModeAtom,
} from "@applemusic-like-lyrics/react-full";
import { useAtom, useAtomValue, useSetAtom, useStore } from "jotai";
import { type FC, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { useLyricParser } from "../../hooks/useLyricParser";
import {
	WebSocketConnectionStatus,
	wsConnectionStatusAtom,
	wsServerUrlAtom,
} from "../../states/appAtoms";
import type { MessageV2, Payload, RepeatMode as WSRepeatMode } from "./types";

export const WebSocketClientContext: FC = () => {
	const store = useStore();
	const { t } = useTranslation();
	const wsRef = useRef<WebSocket | null>(null);
	const connectErrorRef = useRef(false);
	const [status, setStatus] = useAtom(wsConnectionStatusAtom);
	const savedWsUrl = useAtomValue(wsServerUrlAtom);

	const lastServerProgress = useRef<number>(0);
	const lastServerUpdateTime = useRef<number>(0);
	const isPlayingRef = useRef<boolean>(false);
	const setMusicPlayingPosition = useSetAtom(musicPlayingPositionAtom);

	const [rawLyricInput, setRawLyricInput] = useState<{
		lyric: string;
		format: string;
	} | null>(null);

	const { lyricLines: parsedRawLines } = useLyricParser(
		rawLyricInput?.lyric,
		rawLyricInput?.format,
	);

	useEffect(() => {
		if (rawLyricInput) {
			store.set(musicLyricLinesAtom, parsedRawLines);
		}
	}, [parsedRawLines, rawLyricInput, store]);

	const send = (payload: Payload) => {
		if (wsRef.current?.readyState === WebSocket.OPEN) {
			wsRef.current.send(JSON.stringify(payload));
		}
	};

	useLayoutEffect(() => {
		let isUnmounted = false;

		const connect = () => {
			if (isUnmounted) return;

			const wsUrl = savedWsUrl;
			if (!wsUrl) return;

			console.log(`[WS] Connecting to ${wsUrl}...`);
			setStatus(WebSocketConnectionStatus.Connecting);

			connectErrorRef.current = false;

			const ws = new WebSocket(wsUrl);
			wsRef.current = ws;
			ws.binaryType = "arraybuffer";

			ws.onopen = () => {
				console.log("[WS] Connected");
				setStatus(WebSocketConnectionStatus.Connected);
				connectErrorRef.current = false;
				send({ type: "initialize" });
			};

			ws.onclose = () => {
				console.log("[WS] Closed");

				wsRef.current = null;

				if (!connectErrorRef.current) {
					setStatus(WebSocketConnectionStatus.Disconnected);
				}
			};

			ws.onerror = (err) => {
				console.error("[WS] Error", err);
				connectErrorRef.current = true;
				setStatus(WebSocketConnectionStatus.Error);
			};

			ws.onmessage = (event) => {
				if (typeof event.data === "string") {
					try {
						const message: MessageV2 = JSON.parse(event.data);
						handleMessage(message);
					} catch (e) {
						console.warn("[WS] Failed to parse JSON message", e);
					}
				} else if (event.data instanceof ArrayBuffer) {
					handleBinaryMessage(event.data);
				}
			};
		};

		connect();

		return () => {
			isUnmounted = true;
			if (wsRef.current) wsRef.current.close();
		};
	}, [setStatus, savedWsUrl]);

	const handleMessage = (msg: MessageV2) => {
		const payload = msg;

		switch (payload.type) {
			case "ping":
				send({ type: "pong" });
				break;

			case "state": {
				const update = payload.value;
				switch (update.update) {
					case "setMusic":
						store.set(musicIdAtom, update.musicId);
						store.set(musicNameAtom, update.musicName);
						store.set(musicArtistsAtom, update.artists);
						store.set(musicDurationAtom, update.duration);

						store.set(musicLyricLinesAtom, []);
						setRawLyricInput(null);
						store.set(musicQualityTagAtom, null);
						break;

					case "setCover": {
						if (update.source === "Uri") {
							store.set(musicCoverAtom, update.url);
						} else {
							const mime = update.image.mimeType || "image/png";
							store.set(
								musicCoverAtom,
								`data:${mime};base64,${update.image.data}`,
							);
						}
						break;
					}

					case "setLyric": {
						if (update.format === "structured") {
							store.set(musicLyricLinesAtom, update.lines);
							store.set(hideLyricViewAtom, false);
							setRawLyricInput(null);
						} else if (update.format === "ttml") {
							setRawLyricInput({ lyric: update.data, format: "ttml" });
							store.set(hideLyricViewAtom, false);
						} else if (update.format === "raw") {
							setRawLyricInput({
								lyric: update.data,
								format: update.extraFormat,
							});
						}
						break;
					}

					case "progress":
						lastServerProgress.current = update.progress;
						lastServerUpdateTime.current = performance.now();
						setMusicPlayingPosition(update.progress);
						break;

					case "paused":
						store.set(musicPlayingAtom, false);
						isPlayingRef.current = false;
						break;

					case "resumed":
						store.set(musicPlayingAtom, true);
						isPlayingRef.current = true;
						break;

					case "volume":
						store.set(musicVolumeAtom, update.volume);
						break;

					case "modeChanged": {
						let nextMode = RepeatMode.Off;
						const repeatStr = update.repeat.toLowerCase();
						if (repeatStr === "one") nextMode = RepeatMode.One;
						if (repeatStr === "all") nextMode = RepeatMode.All;

						store.set(repeatModeAtom, nextMode);
						store.set(isShuffleActiveAtom, update.shuffle);
						break;
					}
				}
				break;
			}
		}
	};

	const handleBinaryMessage = (buffer: ArrayBuffer) => {
		try {
			const view = new DataView(buffer);
			const magic = view.getUint16(0, true);

			const size = view.getUint32(2, true);

			const dataOffset = 6;

			if (buffer.byteLength < dataOffset + size) {
				console.warn("[WS] Binary message truncated");
				return;
			}

			if (magic === 0) {
				// TODO: 音频数据
			} else if (magic === 1) {
				const imageData = new Uint8Array(buffer, dataOffset, size);
				const blob = new Blob([imageData]);
				const blobUrl = URL.createObjectURL(blob);
				store.set(musicCoverAtom, blobUrl);
			}
		} catch (e) {
			console.error("[WS] Failed to parse binary message", e);
		}
	};

	useEffect(() => {
		let rafId: number;

		const loop = () => {
			if (isPlayingRef.current) {
				const now = performance.now();
				const elapsed = now - lastServerUpdateTime.current;
				const predicted = lastServerProgress.current + elapsed;
				setMusicPlayingPosition(predicted);
			}
			rafId = requestAnimationFrame(loop);
		};

		loop();
		return () => cancelAnimationFrame(rafId);
	}, [setMusicPlayingPosition]);

	useEffect(() => {
		const toEmit = <T,>(onEmit: T) => ({ onEmit });

		store.set(
			onPlayOrResumeAtom,
			toEmit(() => {
				const isPlaying = store.get(musicPlayingAtom);
				send({
					type: "command",
					value: { command: isPlaying ? "pause" : "resume" },
				});
			}),
		);

		store.set(
			onSeekPositionAtom,
			toEmit((pos: number) => {
				send({
					type: "command",
					value: { command: "seekPlayProgress", progress: Math.floor(pos) },
				});
				setMusicPlayingPosition(pos);
				lastServerProgress.current = pos;
				lastServerUpdateTime.current = performance.now();
			}),
		);

		store.set(
			onLyricLineClickAtom,
			toEmit((evt) => {
				const pos = evt.line.getLine().startTime;
				send({
					type: "command",
					value: { command: "seekPlayProgress", progress: Math.floor(pos) },
				});
			}),
		);

		store.set(
			onRequestNextSongAtom,
			toEmit(() => {
				send({ type: "command", value: { command: "forwardSong" } });
			}),
		);
		store.set(
			onRequestPrevSongAtom,
			toEmit(() => {
				send({ type: "command", value: { command: "backwardSong" } });
			}),
		);

		store.set(
			onChangeVolumeAtom,
			toEmit((vol: number) => {
				send({ type: "command", value: { command: "setVolume", volume: vol } });
			}),
		);

		store.set(
			onCycleRepeatModeAtom,
			toEmit(() => {
				const current = store.get(repeatModeAtom);
				const modes: WSRepeatMode[] = ["off", "all", "one"];
				let currentStr: WSRepeatMode = "off";
				if (current === RepeatMode.One) currentStr = "one";
				if (current === RepeatMode.All) currentStr = "all";

				const nextIndex = (modes.indexOf(currentStr) + 1) % modes.length;
				send({
					type: "command",
					value: { command: "setRepeatMode", mode: modes[nextIndex] },
				});
			}),
		);

		store.set(
			onToggleShuffleAtom,
			toEmit(() => {
				const current = store.get(isShuffleActiveAtom);
				send({
					type: "command",
					value: { command: "setShuffleMode", enabled: !current },
				});
			}),
		);

		store.set(
			onClickControlThumbAtom,
			toEmit(() => {
				store.set(isLyricPageOpenedAtom, false);
			}),
		);

		store.set(
			onRequestOpenMenuAtom,
			toEmit(() => {
				toast.info(
					t("amll.openMenuViaRightClick", "请右键歌词页任意位置来打开菜单哦！"),
				);
			}),
		);

		store.set(fftDataAtom, new Array(128).fill(0));
	}, [store]);

	useEffect(() => {
		if (status === WebSocketConnectionStatus.Error) {
			toast.error(t("amll.ws.connectionError", "连接到 WS 服务器失败"));
		} else if (status === WebSocketConnectionStatus.Connected) {
			toast.success(t("amll.ws.connected", "已连接到 WS 服务器"));
		}
	}, [status, t]);

	useEffect(() => {
		if (rawLyricInput) {
			store.set(musicLyricLinesAtom, parsedRawLines);
			store.set(hideLyricViewAtom, parsedRawLines.length === 0);
		}
	}, [parsedRawLines, rawLyricInput, store]);

	return null;
};
