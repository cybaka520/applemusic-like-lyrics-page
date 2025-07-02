import { parseTTML } from "@applemusic-like-lyrics/lyric";
import { Channel, invoke } from "@tauri-apps/api/core";
import { useAtomValue, useStore } from "jotai";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { wsProtocolListenAddrAtom } from "../src/states/appAtoms";
import {
	hideLyricViewAtom,
	musicLyricLinesAtom,
} from "@applemusic-like-lyrics/react-full";

interface WSLyricLine {
	startTime: number;
	endTime: number;
	words: { startTime: number; endTime: number; word: string }[];
	translatedLyric: string;
	romanLyric: string;
	isBG: boolean;
	isDuet: boolean;
}

type WSBodyMessageMap = {
	ping: undefined;
	pong: undefined;
	setLyric: { data: WSLyricLine[] };
	setLyricFromTTML: { data: string };
};
type WSBodyMap = {
	[T in keyof WSBodyMessageMap]: { type: T; value: WSBodyMessageMap[T] };
};

export const useWsLyrics = (isEnabled: boolean) => {
	const wsProtocolListenAddr = useAtomValue(wsProtocolListenAddrAtom);
	const store = useStore();
	const { t } = useTranslation();

	useEffect(() => {
		if (!isEnabled) {
			return;
		}

		const onBodyChannel = new Channel<WSBodyMap[keyof WSBodyMessageMap]>();

		function onBody(payload: WSBodyMap[keyof WSBodyMessageMap]) {
			switch (payload.type) {
				case "ping":
					invoke("ws_boardcast_message", { data: { type: "pong" } });
					break;
				case "setLyric": {
					const processed = payload.value.data.map((line) => ({
						...line,
						words: line.words.map((word) => ({ ...word, obscene: false })),
						translatedLyric: "",
						romanLyric: "",
						isBG: false,
						isDuet: false,
					}));

					if (processed.length > 0) {
						store.set(hideLyricViewAtom, false);
					}
					store.set(musicLyricLinesAtom, processed);
					break;
				}
				case "setLyricFromTTML": {
					try {
						const data = parseTTML(payload.value.data);
						const processed = data.lines.map((line) => ({
							...line,
							words: line.words.map((word) => ({ ...word, obscene: false })),
						}));
						store.set(musicLyricLinesAtom, processed);
					} catch (e) {
						console.error(e);
						toast.error(
							t(
								"ws-protocol.toast.ttmlParseError",
								"解析 TTML 歌词时出错：{{error}}",
								{ error: String(e) },
							),
						);
					}
					break;
				}
			}
		}

		onBodyChannel.onmessage = onBody;

		invoke("ws_close_connection").then(() => {
			const addr = wsProtocolListenAddr || "127.0.0.1:11444";
			invoke("ws_reopen_connection", { addr, channel: onBodyChannel });
		});

		return () => {
			invoke("ws_close_connection");
		};
	}, [isEnabled, wsProtocolListenAddr, store, t]);
};
