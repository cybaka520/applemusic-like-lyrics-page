import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { onCycleRepeatModeAtom, onToggleShuffleAtom } from "./callbacks";

export enum RepeatMode {
	Off = "off",
	One = "one",
	All = "all",
}

export const isShuffleActiveAtom = atomWithStorage<boolean>(
	"amll-react-full.shuffle_active",
	false,
);
export const repeatModeAtom = atomWithStorage<RepeatMode>(
	"amll-react-full.repeat_mode",
	RepeatMode.Off,
);
export const isShuffleEnabledAtom = atom<boolean>(false);
export const isRepeatEnabledAtom = atom<boolean>(false);
export const originalQueueAtom = atomWithStorage<string[] | null>(
	"amll-react-full.original_queue",
	null,
);

export const toggleShuffleActionAtom = atom(null, (get) => {
	const callback = get(onToggleShuffleAtom);
	callback.onEmit?.();
});

export const cycleRepeatModeActionAtom = atom(null, (get) => {
	const callback = get(onCycleRepeatModeAtom);
	callback.onEmit?.();
});
