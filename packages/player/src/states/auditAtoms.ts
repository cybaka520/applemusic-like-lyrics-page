import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export const isAuditModeAtom = atom(false);

export const githubTokenAtom = atomWithStorage<string>(
	"amll-player.audit.githubToken",
	"",
);

export const auditRepoConfigAtom = atomWithStorage(
	"amll-player.audit.repoConfig",
	{
		owner: "Steve-xmh",
		repo: "amll-ttml-db",
	},
);

export const currentAuditPrIdAtom = atom<number | null>(null);

export const auditListRefreshAtom = atom(0);

export const auditProcessingStateAtom = atom<{
	prId: number;
	status: "idle" | "downloading" | "processing" | "error";
	message?: string;
} | null>(null);

export const enableAuditModeAtom = atomWithStorage<boolean>(
	"amll-player.audit.enable",
	false,
);
