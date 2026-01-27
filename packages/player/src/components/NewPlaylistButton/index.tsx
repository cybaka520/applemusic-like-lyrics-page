import { PlusIcon } from "@radix-ui/react-icons";
import { Button, Dialog, Flex, Text, TextField } from "@radix-ui/themes";
import { type FC, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { db } from "../../dexie.ts";

export const NewPlaylistButton: FC = () => {
	const [name, setName] = useState("");
	const { t } = useTranslation();

	const cannotCreate = useMemo(() => name.trim().length === 0, [name]);

	const onAddPlaylist = () => {
		if (cannotCreate) return;
		db.playlists.add({
			name,
			createTime: Date.now(),
			updateTime: Date.now(),
			playTime: 0,
			songIds: [],
		});
	};

	return (
		<Dialog.Root>
			<Dialog.Trigger>
				<Button variant="soft">
					<PlusIcon />
					<Trans i18nKey="newPlaylist.buttonLabel">新建播放列表</Trans>
				</Button>
			</Dialog.Trigger>
			<Dialog.Content maxWidth="450px">
				<Dialog.Title>
					<Trans i18nKey="newPlaylist.dialog.title">新建歌单</Trans>
				</Dialog.Title>
				<Flex gap="3" direction="column">
					<Text>
						<Trans i18nKey="newPlaylist.dialog.name">歌单名称</Trans>
					</Text>
					<TextField.Root
						placeholder={t("newPlaylist.dialog.namePlaceholder", "歌单名称")}
						value={name}
						onChange={(e) => setName(e.currentTarget.value)}
						autoFocus
					/>
				</Flex>
				<Flex gap="3" mt="4" justify="end">
					<Dialog.Close>
						<Button type="button" variant="soft" color="gray">
							<Trans i18nKey="common.dialog.cancel">取消</Trans>
						</Button>
					</Dialog.Close>
					<Dialog.Close disabled={cannotCreate}>
						<Button
							type="submit"
							disabled={cannotCreate}
							onClick={onAddPlaylist}
						>
							<Trans i18nKey="common.dialog.confirm">确认</Trans>
						</Button>
					</Dialog.Close>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
};
