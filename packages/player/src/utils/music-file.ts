import { type IAudioMetadata, parseBlob, selectCover } from "music-metadata";

function formatLrcTimestamp(ms: number): string {
	const totalSeconds = Math.floor(ms / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	const milliseconds = ms % 1000;

	const pad = (num: number) => num.toString().padStart(2, "0");
	const padMs = (num: number) => num.toString().padStart(3, "0");

	return `[${pad(minutes)}:${pad(seconds)}.${padMs(milliseconds)}]`;
}

export interface ExtractedMusicMetadata {
	title: string;
	artist: string;
	album: string;
	cover: Blob;
	lyric: string;
	duration: number;
	metadata: IAudioMetadata;
}

export async function extractMusicMetadata(
	file: Blob,
): Promise<ExtractedMusicMetadata> {
	const metadata = await parseBlob(file);

	const { title, artist, album, picture, lyrics } = metadata.common;

	let lyric = "";

	if (lyrics && lyrics.length > 0) {
		const lyricData = lyrics[0];

		if (lyricData.syncText && lyricData.syncText.length > 0) {
			lyric = lyricData.syncText
				.map((l) => `${formatLrcTimestamp(l.timestamp || 0)} ${l.text}`)
				.join("\n");
		} else if (lyricData.text) {
			lyric = lyricData.text;
		}
	}

	const coverImage = selectCover(picture);

	let coverBlob = new Blob([], { type: "image/png" });
	if (coverImage) {
		coverBlob = new Blob([coverImage.data as BlobPart], {
			type: coverImage.format,
		});
	}

	return {
		title: title || "",
		artist: artist || "Unknown Artist",
		album: album || "Unknown Album",
		cover: coverBlob,
		lyric,
		duration: metadata.format.duration || 0,
		metadata,
	};
}
