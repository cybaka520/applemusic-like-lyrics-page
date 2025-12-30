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

export const toggleShuffleActionAtom = atom(null, (get) => {
	const callback = get(onToggleShuffleAtom);
	callback.onEmit?.();
});

export const cycleRepeatModeActionAtom = atom(null, (get) => {
	const callback = get(onCycleRepeatModeAtom);
	callback.onEmit?.();
});
