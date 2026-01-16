const KXZ_API_BASE = "https://api.kxzjoker.cn/api/163_music";
const TOUBIEC_API_BASE = "https://wyapi-1.toubiec.cn/api/music";

export type AudioSourceType = "KXZ" | "TOUBIEC";

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

export async function fetchAudioSource(
	platformId: string,
	source: AudioSourceType = "TOUBIEC",
): Promise<AudioSourceResult> {
	switch (source) {
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
}
