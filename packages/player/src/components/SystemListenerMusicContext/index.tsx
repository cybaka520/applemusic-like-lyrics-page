import {
	musicAlbumNameAtom,
	musicArtistsAtom,
	musicCoverAtom,
	musicCoverIsVideoAtom,
	musicDurationAtom,
	musicLyricLinesAtom,
	musicNameAtom,
	musicPlayingAtom,
	musicPlayingPositionAtom,
	onChangeVolumeAtom,
	onClickControlThumbAtom,
	onClickLeftFunctionButtonAtom,
	onClickRightFunctionButtonAtom,
	onLyricLineClickAtom,
	onPlayOrResumeAtom,
	onRequestNextSongAtom,
	onRequestOpenMenuAtom,
	onRequestPrevSongAtom,
	onSeekPositionAtom,
} from "@applemusic-like-lyrics/react-full";
import { invoke } from '@tauri-apps/api/core';
import { listen } from "@tauri-apps/api/event";
import { useSetAtom, useStore } from "jotai";
import { type FC, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { musicIdAtom, smtcTrackIdAtom } from "../../states";

type SmtcPartialUpdatePayload =
	| {
		type: "TrackMetadata";
		data: {
			title: string | null;
			artist: string | null;
			albumTitle: string | null;
			durationMs: number | null;
		};
	}
	| { type: "CoverData"; data: number[] | null }
	| { type: "PlaybackStatus"; data: { isPlaying: boolean; positionMs: number } }
	| { type: "SessionsChanged"; data: { sessionId: string; displayName: string }[] }
	| { type: "SelectedSessionVanished"; data: string }
	| { type: "Error"; data: string };

export const SystemListenerMusicContext: FC = () => {
	const store = useStore();
	const { t } = useTranslation();
	const setMusicId = useSetAtom(musicIdAtom);
	const setSmtcTrackId = useSetAtom(smtcTrackIdAtom);

	useEffect(() => {
		console.log(
			"[SystemListenerMusicContext] 组件已挂载。正在请求初始状态更新...",
		);
		invoke("request_smtc_update").catch((err) => {
			console.error("请求初始 SMTC 状态失败：", err);
		});

		const toEmit = <T,>(onEmit: T) => ({
			onEmit,
		});

		store.set(
			onPlayOrResumeAtom,
			toEmit(() => {
				const isPlaying = store.get(musicPlayingAtom);
				invoke("control_external_media", {
					payload: isPlaying ? { command: "Pause" } : { command: "Play" },
				});
			}),
		);
		store.set(
			onRequestNextSongAtom,
			toEmit(() => {
				invoke("control_external_media", {
					payload: { command: "SkipNext" },
				});
			}),
		);
		store.set(
			onRequestPrevSongAtom,
			toEmit(() => {
				invoke("control_external_media", {
					payload: { command: "SkipPrevious" },
				});
			}),
		);
		store.set(
			onSeekPositionAtom,
			toEmit((time: number) => {
				invoke("control_external_media", {
					payload: {
						command: "SeekTo",
						payload: { time_ms: time },
					},
				});
			}),
		);
		store.set(
			onLyricLineClickAtom,
			toEmit((evt) => {
				const time = evt.line.getLine().startTime;
				invoke("control_external_media", {
					payload: {
						command: "SeekTo",
						payload: { time_ms: time },
					},
				});
			}),
		);
		store.set(
			onChangeVolumeAtom,
			toEmit(() => {
				toast.info(t("amll.systemListener.volumeNotSupported", "请在系统或其他应用中直接调节音量"));
			}),
		);
		store.set(onClickControlThumbAtom, toEmit(() => { }));
		store.set(onRequestOpenMenuAtom, toEmit(() => { }));
		store.set(onClickLeftFunctionButtonAtom, toEmit(() => { }));
		store.set(onClickRightFunctionButtonAtom, toEmit(() => { }));


		const unlistenPromise = listen<SmtcPartialUpdatePayload>(
			"smtc_update",
			(event) => {
				const { type, data } = event.payload;

				switch (type) {
					case "TrackMetadata": {
						const newTrackId = `${data.title}-${data.artist}-${data.albumTitle}`;
						const oldTrackId = store.get(smtcTrackIdAtom);

						console.log(`[SystemListener] TrackMetadata 更新。新 ID: ${newTrackId}, 旧 ID: ${oldTrackId}`);

						if (newTrackId !== oldTrackId) {
							setSmtcTrackId(newTrackId);

							setMusicId(newTrackId);

							store.set(musicPlayingPositionAtom, 0);

							store.set(musicLyricLinesAtom, []);
						}

						store.set(musicNameAtom, data.title ?? "未知曲目");
						store.set(musicAlbumNameAtom, data.albumTitle ?? "");
						store.set(
							musicArtistsAtom,
							(data.artist ?? "未知艺术家").split(/[/,]/).map((v) => ({
								id: v.trim(), name: v.trim(),
							})),
						);
						store.set(musicDurationAtom, data.durationMs ?? 0);
						break;
					}

					case "CoverData":
						if (data && data.length > 0) {
							const imgBlob = new Blob([new Uint8Array(data)], { type: "image/png" });
							const newUrl = URL.createObjectURL(imgBlob);
							try {
								const oldUrl = store.get(musicCoverAtom);
								if (oldUrl.startsWith("blob:")) URL.revokeObjectURL(oldUrl);
							} catch (e) { }
							store.set(musicCoverAtom, newUrl);
							store.set(musicCoverIsVideoAtom, false);
						} else {
							store.set(musicCoverAtom, "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7");
						}
						break;

					case "PlaybackStatus": {

						store.set(musicPlayingAtom, data.isPlaying);

						store.set(musicPlayingPositionAtom, data.positionMs);

						break;
					}

					case "SessionsChanged":
						break;

					case "SelectedSessionVanished":
						toast.warn(t("amll.systemListener.sessionVanished", "被监听的应用似乎已关闭"));
						store.set(musicPlayingAtom, false);
						break;

					case "Error":
						console.error(`[SystemListener] 错误：${data}`);
						toast.error(t("amll.systemListener.error", "系统监听发生错误: {error}", { error: data }));
						break;
					default:
						console.warn(`[SystemListener] 收到未处理的事件类型：${type}`);
				}
			},
		);

		return () => {
			console.log("[SystemListenerMusicContext] 组件即将卸载。正在清理监听器和回调函数。");
			unlistenPromise.then((unlisten) => unlisten());

			store.set(onPlayOrResumeAtom, toEmit(() => { }));
			store.set(onRequestNextSongAtom, toEmit(() => { }));
			store.set(onRequestPrevSongAtom, toEmit(() => { }));
			store.set(onSeekPositionAtom, toEmit(() => { }));
			store.set(onLyricLineClickAtom, toEmit(() => { }));
			store.set(onChangeVolumeAtom, toEmit(() => { }));
			store.set(onClickControlThumbAtom, toEmit(() => { }));
			store.set(onRequestOpenMenuAtom, toEmit(() => { }));
			store.set(onClickLeftFunctionButtonAtom, toEmit(() => { }));
			store.set(onClickRightFunctionButtonAtom, toEmit(() => { }));

			store.set(musicNameAtom, "");
			store.set(musicAlbumNameAtom, "");
			store.set(musicArtistsAtom, []);
			store.set(musicPlayingAtom, false);
			store.set(musicPlayingPositionAtom, 0);
			store.set(musicDurationAtom, 0);
			store.set(musicCoverAtom, "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7");
			store.set(musicLyricLinesAtom, []);
			setSmtcTrackId("");
			setMusicId("");
		};
	}, [store, t, setMusicId, setSmtcTrackId]);

	return null;
};