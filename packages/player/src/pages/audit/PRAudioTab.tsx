import { PlayIcon, ReloadIcon } from "@radix-ui/react-icons";
import {
	Badge,
	Box,
	Button,
	Card,
	Flex,
	Skeleton,
	Spinner,
	Text,
} from "@radix-ui/themes";
import type { ChangeEvent } from "react";
import { NeteaseIcon } from "../../utils/PlatformIcons";
import styles from "./index.module.css";

interface PRAudioTabProps {
	isProcessing: boolean;
	candidateIds: string[];
	currentPlatformId?: string;
	currentSongName?: string;
	audioLoadStatus: Record<string, string>;
	onPlayId: (id: string) => void;
	onPlayLocal: () => void;
	onFileUpload: (e: ChangeEvent<HTMLInputElement>) => void;
}

export const PRAudioTab = ({
	isProcessing,
	candidateIds,
	currentPlatformId,
	currentSongName,
	audioLoadStatus,
	onPlayId,
	onPlayLocal,
	onFileUpload,
}: PRAudioTabProps) => {
	const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
		onFileUpload(e);
		e.target.value = "";
	};

	return (
		<Box p="5">
			<div className={styles.statusCard}>
				{isProcessing ? (
					<Flex direction="column" gap="2">
						<Skeleton height="40px" width="100%" />
						<Skeleton height="40px" width="100%" />
					</Flex>
				) : (
					<Flex direction="column" gap="2">
						{candidateIds.length > 0 ? (
							candidateIds.map((id) => {
								const status = audioLoadStatus[id] || "idle";
								const isCurrent = currentPlatformId === id;
								return (
									<Card
										key={id}
										variant="classic"
										style={{ padding: "8px 12px" }}
									>
										<Flex justify="between" align="center">
											<Flex gap="2" align="center">
												<NeteaseIcon width="20" height="20" />
												<Text weight="bold" size="3">
													{id}
												</Text>
												{isCurrent && <Badge color="green">当前使用中</Badge>}
											</Flex>
											{status === "loading" ? (
												<Button
													disabled
													variant="soft"
													style={{ minWidth: "70px" }}
												>
													<Spinner />
												</Button>
											) : status === "error" ? (
												<Button
													color="red"
													variant="soft"
													onClick={() => onPlayId(id)}
												>
													<ReloadIcon /> 重试
												</Button>
											) : (
												<Button
													variant={isCurrent ? "solid" : "outline"}
													onClick={() => onPlayId(id)}
												>
													<PlayIcon /> 播放
												</Button>
											)}
										</Flex>
									</Card>
								);
							})
						) : (
							<Text color="gray" size="2" align="center" mb="2">
								未在 TTML 中找到网易云 ID
							</Text>
						)}

						{currentPlatformId === "manual" && (
							<Card
								variant="classic"
								style={{
									padding: "8px 12px",
									borderLeft: "4px solid var(--accent-9)",
								}}
							>
								<Flex justify="between" align="center">
									<Flex gap="2" align="center">
										<Badge color="blue">本地文件</Badge>
										<Text weight="bold">
											{currentSongName || "Unknown File"}
										</Text>
									</Flex>
									<Button variant="solid" onClick={onPlayLocal}>
										<PlayIcon /> 播放
									</Button>
								</Flex>
							</Card>
						)}

						<Button
							asChild
							variant="outline"
							size="3"
							color="gray"
							style={{
								width: "100%",
								marginTop: "8px",
								height: "48px",
							}}
						>
							<label>
								<input
									type="file"
									hidden
									accept="audio/*"
									onChange={handleFileChange}
								/>
								<Flex gap="2" align="center">
									<Text size="2">
										{currentPlatformId === "manual"
											? "替换本地文件"
											: "使用本地文件"}
									</Text>
								</Flex>
							</label>
						</Button>
					</Flex>
				)}
			</div>
		</Box>
	);
};
