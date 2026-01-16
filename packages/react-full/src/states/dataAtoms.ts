import type { LyricLine } from "@applemusic-like-lyrics/lyric";
import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

/**
 * 艺术家信息的标准结构
 */
export interface ArtistStateEntry {
	name: string;
	id: string;
}

/**
 * 音频质量的类型枚举
 */
export enum AudioQualityType {
	None = "none",
	Standard = "standard",
	Lossless = "lossless",
	HiResLossless = "hi-res-lossless",
	DolbyAtmos = "dolby-atmos",
}

/**
 * 描述音频质量完整信息的接口
 */
export interface MusicQualityState {
	type: AudioQualityType;
	codec: string;
	channels: number;
	sampleRate: number;
	sampleFormat: string;
}

// ==================================================================
//                        音乐核心数据原子状态
// ==================================================================

/**
 * 当前播放歌曲的唯一标识符
 */
export const musicIdAtom = atomWithStorage<string | null>(
	"amll-react-full.current_id",
	null,
	undefined,
	{ getOnInit: true },
);

/**
 * 当前播放的音乐名称
 */
export const musicNameAtom = atom("未知歌曲");

/**
 * 当前播放的音乐创作者列表
 */
export const musicArtistsAtom = atom<ArtistStateEntry[]>([
	{ name: "未知创作者", id: "unknown" },
]);

/**
 * 当前播放的音乐所属专辑名称
 */
export const musicAlbumNameAtom = atom("未知专辑");

/**
 * 当前播放的音乐专辑封面 URL
 * 除了图片也可以是视频资源
 */
export const musicCoverAtom = atom("");

/**
 * 当前播放的音乐专辑封面资源是否为视频
 */
export const musicCoverIsVideoAtom = atom(false);

/**
 * 当前音乐的总时长，单位为毫秒
 */
export const musicDurationAtom = atom(0);

/**
 * 当前音乐是否正在播放
 */
export const musicPlayingAtom = atom(false);

/**
 * 当前音乐的播放进度，单位为毫秒
 */
export const musicPlayingPositionAtom = atomWithStorage<number>(
	"amll-react-full.position",
	0,
	undefined,
	{ getOnInit: true },
);

/**
 * 当前播放的音乐音量大小，范围在 [0.0-1.0] 之间
 */
export const musicVolumeAtom = atomWithStorage(
	"amll-react-full.musicVolumeAtom",
	0.5,
	undefined,
	{ getOnInit: true },
);

/**
 * 当前播放的音乐的歌词行数据
 */
export const musicLyricLinesAtom = atom<LyricLine[]>([]);

/**
 * 当前音乐的音质信息对象
 */
export const musicQualityAtom = atom<MusicQualityState>({
	type: AudioQualityType.None,
	codec: "unknown",
	channels: 2,
	sampleRate: 44100,
	sampleFormat: "s16",
});

/**
 * 根据音质信息生成的、用于UI展示的标签内容
 * 如果为 null，则不显示标签
 */
export const musicQualityTagAtom = atom<{
	tagIcon: boolean;
	tagText: string;
	isDolbyAtmos: boolean;
} | null>(null);

// ==================================================================
//                        音频可视化相关原子状态
// ==================================================================

/**
 * 用于音频可视化频谱图的实时频域数据
 */
export const fftDataAtom = atom<number[]>([]);

/**
 * 代表低频部分的音量大小，用于背景脉动等效果
 * 取值范围建议在 [0.0-1.0] 之间
 */
export const lowFreqVolumeAtom = atom<number>(1);

/**
 * 歌词偏移量，单位为毫秒
 */
export const musicLyricOffsetAtom = atom<number>(0);
