import type { LyricLine } from "@applemusic-like-lyrics/lyric";

export type RepeatMode = "off" | "all" | "one";

export interface Artist {
	id: string;
	name: string;
}

export interface MusicInfo {
	musicId: string;
	musicName: string;
	albumId: string;
	albumName: string;
	artists: Artist[];
	duration: number;
}

export interface ImageData {
	mimeType?: string;
	data: string;
}

export type AlbumCover =
	| { source: "Uri"; url: string }
	| { source: "Data"; image: ImageData };

export type LyricContent =
	| {
			format: "structured";
			lines: LyricLine[];
	  }
	| {
			format: "ttml";
			data: string;
	  }
	| {
			format: "raw";
			data: string;
			extraFormat: "lrc" | "yrc" | "qrc" | "eslrc" | "lys";
	  };

export type Command =
	| { command: "pause" }
	| { command: "resume" }
	| { command: "forwardSong" }
	| { command: "backwardSong" }
	| { command: "setVolume"; volume: number }
	| { command: "seekPlayProgress"; progress: number }
	| { command: "setRepeatMode"; mode: RepeatMode }
	| { command: "setShuffleMode"; enabled: boolean };

export type StateUpdate =
	| ({ update: "setMusic" } & MusicInfo)
	| ({ update: "setCover" } & AlbumCover)
	| ({ update: "setLyric" } & LyricContent)
	| { update: "progress"; progress: number }
	| { update: "volume"; volume: number }
	| { update: "paused" }
	| { update: "resumed" }
	| { update: "audioData"; data: number[] }
	| { update: "modeChanged"; repeat: RepeatMode; shuffle: boolean };

export type Payload =
	| { type: "initialize" }
	| { type: "ping" }
	| { type: "pong" }
	| { type: "command"; value: Command }
	| { type: "state"; value: StateUpdate };

export type MessageV2 = Payload;
