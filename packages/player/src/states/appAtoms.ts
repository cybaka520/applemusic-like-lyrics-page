import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

// ==================================================================
//                            类型定义
// ==================================================================

/**
 * 定义了应用的主题模式枚举。
 */
export enum DarkMode {
	Auto = "auto",
	Light = "light",
	Dark = "dark",
}

// ==================================================================
//                        应用核心配置
// ==================================================================

/**
 * 应用的显示语言。
 * @default "zh-CN"
 */
export const displayLanguageAtom = atomWithStorage(
	"amll-player.displayLanguage",
	"zh-CN",
);

/**
 * 应用的主题（暗黑/明亮）模式设置。
 * @default DarkMode.Auto
 */
export const darkModeAtom = atomWithStorage(
	"amll-player.darkMode",
	DarkMode.Auto,
);

/**
 * 歌词库的版本号，从 version.json 的 commit 字段获得
 */
export const lyricDBVersionAtom = atomWithStorage<string | null>(
	"amll-player.lyricDBVersion",
	null,
	undefined,
	{ getOnInit: true },
);

/**
 * 是否在应用中显示性能统计（Stat.js）面板。
 */
export const showStatJSFrameAtom = atomWithStorage(
	"amll-player.showStatJSFrame",
	false,
);

// ==================================================================
//                        应用 UI 状态
// ==================================================================

/**
 * @description 查询当前是否是深色模式
 */
const systemDarkModeQuery =
	typeof window !== "undefined" && window.matchMedia
		? window.matchMedia("(prefers-color-scheme: dark)")
		: null;

/**
 * @description 用于自动检测系统是否处于深色模式
 */
export const autoDarkModeAtom = atom(
	systemDarkModeQuery ? systemDarkModeQuery.matches : true,
);

autoDarkModeAtom.onMount = (set) => {
	if (!systemDarkModeQuery) return;

	const handler = (e: MediaQueryListEvent) => {
		set(e.matches);
	};

	systemDarkModeQuery.addEventListener("change", handler);

	return () => {
		systemDarkModeQuery.removeEventListener("change", handler);
	};
};

/**
 * @description 当前是否是深色模式
 */
export const isDarkThemeAtom = atom(
	(get) =>
		get(darkModeAtom) === DarkMode.Auto
			? get(autoDarkModeAtom)
			: get(darkModeAtom) === DarkMode.Dark,
	(_get, set, newIsDark: boolean) =>
		set(darkModeAtom, newIsDark ? DarkMode.Dark : DarkMode.Light),
);

/**
 * 控制播放列表卡片是否打开。
 */
export const playlistCardOpenedAtom = atom(false);

/**
 * 控制录制面板是否打开。
 */
export const recordPanelOpenedAtom = atom(false);

/**
 * 控制主界面底部的“正在播放”栏是否隐藏。
 */
export const hideNowPlayingBarAtom = atom(false);

/**
 * @description 存储 Song ID 列表
 */
export const currentMusicQueueAtom = atomWithStorage<string[]>(
	"amll-player.queue",
	[],
	undefined,
	{ getOnInit: true },
);

export const originalQueueAtom = atomWithStorage<string[] | null>(
	"amll-player.original_queue",
	null,
	undefined,
	{ getOnInit: true },
);

/**
 * @description 当前播放索引
 */
export const currentMusicIndexAtom = atomWithStorage<number>(
	"amll-player.index",
	0,
);

/**
 * @description 请求播放指定索引的歌曲
 * @param index 索引
 */
export const onRequestPlaySongByIndexAtom = atom<{
	onEmit: (index: number) => void;
}>({
	onEmit: () => {},
});

/**
 * 控制音质详情对话框是否打开
 */
export const audioQualityDialogOpenedAtom = atom(false);

export enum AppMode {
	Local = "local",
	WebSocket = "websocket",
}

export const appModeAtom = atom<AppMode>(AppMode.Local);

export enum WebSocketConnectionStatus {
	Disconnected = "disconnected",
	Connecting = "connecting",
	Connected = "connected",
	Error = "error",
}

export const wsConnectionStatusAtom = atom<WebSocketConnectionStatus>(
	WebSocketConnectionStatus.Disconnected,
);

export const wsServerUrlAtom = atomWithStorage<string>(
	"amll-player.wsServerUrl",
	"ws://localhost:11455",
);
