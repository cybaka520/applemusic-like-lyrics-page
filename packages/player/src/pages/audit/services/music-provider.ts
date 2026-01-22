import { NeteaseClient, type NeteaseSongDetail } from "./netease-client";

const KXZ_API_BASE = "https://api.kxzjoker.cn/api/163_music";
const TOUBIEC_API_BASE = "https://wyapi-1.toubiec.cn/api/music";

export type AudioSourceType = "KXZ" | "TOUBIEC" | "NETEASE_PRIVATE";

export interface StandardMetadata {
	name: string;
	artist: string;
	album: string;
	coverUrl: string;
}

export interface AudioSourceResult {
	audioUrl: string;
	metadata?: StandardMetadata;
}

interface KxzApiResponse {
	status: number;
	name: string;
	pic: string;
	ar_name: string;
	al_name: string;
	level: string;
	url: string;
	lyric: string;
	tlyric: string;
}

interface ToubiecDetailResponse {
	code: number;
	msg: string;
	data: {
		id: number;
		name: string;
		singer: string;
		album: string;
		picimg: string;
		duration: string;
		time: string;
	};
}

interface ToubiecUrlResponse {
	code: number;
	msg: string;
	data: {
		id: number;
		url: string;
		level: string;
	}[];
}

function normalizeNeteaseMetadata(detail: NeteaseSongDetail): StandardMetadata {
	return {
		name: detail.name,
		artist: detail.artists.map((a) => a.name).join(", "),
		album: detail.album.name,
		coverUrl: detail.album.picUrl,
	};
}

export async function fetchAudioSource(
	platformId: string,
	source: AudioSourceType = "TOUBIEC",
	cookie?: string,
): Promise<AudioSourceResult> {
	const metaPromise = NeteaseClient.song
		.getDetails([platformId], cookie)
		.then((details) => details[0])
		.catch((e) => {
			console.warn("用网易云音乐 API 获取歌曲元数据失败", e);
			return null;
		});

	const sourcePromise = (async (): Promise<AudioSourceResult> => {
		switch (source) {
			case "NETEASE_PRIVATE": {
				const url = await NeteaseClient.song.getUrl(
					platformId,
					"exhigh",
					cookie,
				);
				if (!url) {
					throw new Error("找不到音频 URL，可能需要 VIP？");
				}
				return { audioUrl: url };
			}

			case "TOUBIEC": {
				const headers = { "Content-Type": "application/json" };
				const body = JSON.stringify({ id: platformId });
				const urlBody = JSON.stringify({ id: platformId, level: "exhigh" });

				const [detailRes, urlRes] = await Promise.all([
					fetch(`${TOUBIEC_API_BASE}/detail`, {
						method: "POST",
						headers,
						body,
					}),
					fetch(`${TOUBIEC_API_BASE}/url`, {
						method: "POST",
						headers,
						body: urlBody,
					}),
				]);

				if (!detailRes.ok || !urlRes.ok) {
					throw new Error(
						`Toubiec API HTTP Error: Detail(${detailRes.status}) / URL(${urlRes.status})`,
					);
				}

				const detailData: ToubiecDetailResponse = await detailRes.json();
				const urlData: ToubiecUrlResponse = await urlRes.json();

				if (detailData.code !== 200 || urlData.code !== 200) {
					throw new Error(
						`Toubiec API Logic Error: ${detailData.msg || urlData.msg}`,
					);
				}

				const targetUrl = urlData.data[0]?.url;
				if (!targetUrl) {
					throw new Error("Toubiec API returned no audio URL");
				}

				return {
					audioUrl: targetUrl,
					metadata: {
						name: detailData.data.name,
						artist: detailData.data.singer,
						album: detailData.data.album,
						coverUrl: detailData.data.picimg,
					},
				};
			}

			default: {
				const apiRes = await fetch(
					`${KXZ_API_BASE}?ids=${platformId}&level=exhigh&type=json`,
				);
				const apiData: KxzApiResponse = await apiRes.json();

				if (apiData.status !== 200) {
					throw new Error(`Music API Error: ${apiData.status}`);
				}

				return {
					audioUrl: apiData.url,
					metadata: {
						name: apiData.name,
						artist: apiData.ar_name,
						album: apiData.al_name,
						coverUrl: apiData.pic,
					},
				};
			}
		}
	})();

	const [neteaseMeta, sourceResult] = await Promise.all([
		metaPromise,
		sourcePromise,
	]);

	return {
		audioUrl: sourceResult.audioUrl,
		metadata: neteaseMeta
			? normalizeNeteaseMetadata(neteaseMeta)
			: sourceResult.metadata,
	};
}
