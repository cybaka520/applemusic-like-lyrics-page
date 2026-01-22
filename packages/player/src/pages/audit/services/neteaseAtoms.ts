import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { NeteaseProfile } from "../services/netease-client";

const COOKIE_STORAGE_KEY = "audit_netease_cookie_v1";

export const neteaseCookieAtom = atomWithStorage<string>(
	COOKIE_STORAGE_KEY,
	"",
);

export const neteaseUserAtom = atom<NeteaseProfile | null>(null);

export const isNeteaseLoggedInAtom = atom((get) => {
	const user = get(neteaseUserAtom);
	return user !== null;
});

export const isNeteaseVipAtom = atom((get) => {
	const user = get(neteaseUserAtom);
	return user?.vipType === 11 || user?.vipType === 110;
});
