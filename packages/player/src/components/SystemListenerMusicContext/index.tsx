import { FFTPlayer } from "@applemusic-like-lyrics/fft";
import {
	fftDataAtom,
	MusicContextMode,
	musicAlbumNameAtom,
	musicArtistsAtom,
	musicContextModeAtom,
	musicCoverAtom,
	musicCoverHashAtom,
	musicDurationAtom,
	musicNameAtom,
	musicPlayingAtom,
	musicPlayingPositionAtom,
	musicVolumeAtom,
	onChangeVolumeAtom,
	onPlayOrResumeAtom,
	onRequestNextSongAtom,
	onRequestPrevSongAtom,
	RepeatMode,
	smtcCanPauseAtom,
	smtcCanPlayAtom,
	smtcCanSkipNextAtom,
	smtcCanSkipPreviousAtom,
	smtcRepeatModeAtom,
	smtcSessionsAtom,
	smtcShuffleStateAtom,
} from "@applemusic-like-lyrics/states";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import { type FC, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { FFTToLowPassContext } from "../LocalMusicContext/index.tsx";

type SmtcEvent =
	| {
			type: "trackChanged";
			data: {
				title: string | null;
				artist: string | null;
				albumTitle: string | null;
				durationMs: number | null;
				positionMs: number | null;
				isPlaying: boolean | null;
				isShuffleActive: boolean | null;
				repeatMode: RepeatMode | null;
				canPlay: boolean | null;
				canPause: boolean | null;
				canSkipNext: boolean | null;
				canSkipPrevious: boolean | null;
				coverData: string | null;
				coverDataHash: number | null;
			};
	  }
	| {
			type: "sessionsChanged";
			data: { sessionId: string; displayName: string }[];
	  }
	| { type: "selectedSessionVanished"; data: string }
	| { type: "error"; data: string }
	| { type: "audioData"; data: number[] }
	| { type: "volumeChanged"; data: { volume: number; isMuted: boolean } };

export const SystemListenerMusicContext: FC = () => {
	const store = useStore();
	const { t } = useTranslation();
	const setSmtcSessions = useSetAtom(smtcSessionsAtom);
	const musicContextMode = useAtomValue(musicContextModeAtom);

	useEffect(() => {
		if (musicContextMode !== MusicContextMode.SystemListener) {
			return;
		}

		const toEmit = <T,>(onEmit: T) => ({ onEmit });

		store.set(
			onPlayOrResumeAtom,
			toEmit(() => {
				const isPlaying = store.get(musicPlayingAtom);
				invoke("control_external_media", {
					payload: { type: isPlaying ? "pause" : "play" },
				});
			}),
		);
		store.set(
			onRequestNextSongAtom,
			toEmit(() => {
				invoke("control_external_media", { payload: { type: "skipNext" } });
			}),
		);
		store.set(
			onRequestPrevSongAtom,
			toEmit(() => {
				invoke("control_external_media", {
					payload: { type: "skipPrevious" },
				});
			}),
		);
		store.set(
			onChangeVolumeAtom,
			toEmit((volume: number) => {
				invoke("control_external_media", {
					payload: { type: "setVolume", volume },
				});
			}),
		);

		return () => {
			const doNothing = toEmit(() => {});
			store.set(onPlayOrResumeAtom, doNothing);
			store.set(onRequestNextSongAtom, doNothing);
			store.set(onRequestPrevSongAtom, doNothing);
			store.set(onChangeVolumeAtom, doNothing);
		};
	}, [musicContextMode, store]);

	useEffect(() => {
		if (musicContextMode !== MusicContextMode.SystemListener) {
			return;
		}

		const fftPlayer = new FFTPlayer();
		const fftResult = new Float32Array(64);
		let animationFrameId: number;

		let unlistenFunction: (() => void) | null = null;

		const onFFTFrame = () => {
			fftPlayer.read(fftResult);
			store.set(fftDataAtom, [...fftResult]);
			animationFrameId = requestAnimationFrame(onFFTFrame);
		};
		animationFrameId = requestAnimationFrame(onFFTFrame);

		const setupAsync = async () => {
			try {
				const unlisten = await listen<SmtcEvent>("smtc_update", (event) => {
					const { type, data } = event.payload;
					switch (type) {
						case "trackChanged": {
							const newTrackInfo = data;

							store.set(musicNameAtom, newTrackInfo.title ?? "未知曲目");
							store.set(musicArtistsAtom, [
								{ name: newTrackInfo.artist ?? "未知艺术家", id: "unknown" },
							]);
							store.set(musicAlbumNameAtom, newTrackInfo.albumTitle ?? "");
							store.set(musicDurationAtom, newTrackInfo.durationMs ?? 0);
							store.set(musicPlayingPositionAtom, newTrackInfo.positionMs ?? 0);
							store.set(musicPlayingAtom, newTrackInfo.isPlaying ?? false);
							store.set(
								smtcShuffleStateAtom,
								newTrackInfo.isShuffleActive ?? false,
							);
							store.set(
								smtcRepeatModeAtom,
								newTrackInfo.repeatMode ?? RepeatMode.Off,
							);
							store.set(smtcCanPlayAtom, newTrackInfo.canPlay ?? false);
							store.set(smtcCanPauseAtom, newTrackInfo.canPause ?? false);
							store.set(smtcCanSkipNextAtom, newTrackInfo.canSkipNext ?? false);
							store.set(
								smtcCanSkipPreviousAtom,
								newTrackInfo.canSkipPrevious ?? false,
							);

							if (newTrackInfo.coverDataHash != null) {
								const currentCoverHash = store.get(musicCoverHashAtom);
								const newCoverHash = newTrackInfo.coverDataHash;

								if (newCoverHash !== currentCoverHash) {
									store.set(musicCoverHashAtom, newCoverHash);
									if (newTrackInfo.coverData) {
										store.set(
											musicCoverAtom,
											`data:image/png;base64,${newTrackInfo.coverData}`,
										);
									} else {
										store.set(musicCoverAtom, "");
									}
								}
							}
							break;
						}
						case "volumeChanged": {
							store.set(musicVolumeAtom, data.isMuted ? 0 : data.volume);
							break;
						}
						case "sessionsChanged": {
							setSmtcSessions(data);
							break;
						}
						case "selectedSessionVanished":
							toast.warn(t("amll.systemListener.sessionVanished"));
							store.set(musicPlayingAtom, false);
							setSmtcSessions([]);
							break;
						case "error":
							toast.error(t("amll.systemListener.error", { error: data }));
							break;
						case "audioData": {
							if (fftPlayer) {
								fftPlayer.pushDataI16(
									48000,
									2,
									new Int16Array(new Uint8Array(data).buffer),
								);
							}
							break;
						}
					}
				});

				unlistenFunction = unlisten;

				await invoke("request_smtc_update");
				await invoke("control_external_media", {
					payload: { type: "startAudioVisualization" },
				});
			} catch (error) {
				console.error("设置监听器或请求初始状态时失败:", error);
				toast.error("无法连接到后台服务。");
			}
		};

		setupAsync();

		return () => {
			if (unlistenFunction) {
				unlistenFunction();
			}

			cancelAnimationFrame(animationFrameId);
			fftPlayer.free();
			invoke("control_external_media", {
				payload: { type: "stopAudioVisualization" },
			});
		};
	}, [musicContextMode, store, t, setSmtcSessions]);

	return <FFTToLowPassContext />;
};
