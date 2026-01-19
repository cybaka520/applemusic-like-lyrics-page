import {
	DiscIcon,
	ExclamationTriangleIcon,
	ExternalLinkIcon,
	LayersIcon,
	Link2Icon,
	PersonIcon,
} from "@radix-ui/react-icons";
import {
	Badge,
	Box,
	Callout,
	Card,
	Flex,
	Heading,
	Text,
} from "@radix-ui/themes";
import { useMemo } from "react";
import {
	AppleMusicIcon,
	NeteaseIcon,
	QQMusicIcon,
	SpotifyIcon,
} from "../../utils/PlatformIcons";
import styles from "./index.module.css";
import type { GitHubPR } from "./services/audit-service";

const getPlatformConfig = (key: string) => {
	const lowerKey = key.toLowerCase();

	if (lowerKey.includes("qq")) {
		return {
			Icon: QQMusicIcon,
			label: "QQ 音乐",
			color: undefined,
			internalKey: "qqMusicId",
		};
	}
	if (lowerKey.includes("spotify")) {
		return {
			Icon: SpotifyIcon,
			label: "Spotify",
			color: undefined,
			internalKey: "spotifyId",
		};
	}
	if (lowerKey.includes("apple")) {
		return {
			Icon: AppleMusicIcon,
			label: "Apple Music",
			color: undefined,
			internalKey: "appleMusicId",
		};
	}
	if (lowerKey.includes("网易") || lowerKey.includes("netease")) {
		return {
			Icon: NeteaseIcon,
			label: "网易云音乐",
			color: undefined,
			internalKey: "ncmMusicId",
		};
	}

	return {
		Icon: Link2Icon,
		label: key.replace("歌曲关联", "").replace("ID", "").trim(),
		color: "var(--gray-10)",
		internalKey: "",
	};
};

const parseBotBody = (body: string) => {
	const sections: Record<string, string[]> = {};
	let currentKey = "";

	body.split("\n").forEach((line) => {
		const trimmed = line.trim();
		if (!trimmed) return;

		// 包含了解析警告的部分，由 extractWarnings 解析并处理
		if (trimmed.startsWith(">")) return;

		if (trimmed.startsWith("### ")) {
			currentKey = trimmed.replace("### ", "").trim();
			sections[currentKey] = [];
		} else if (currentKey) {
			let content = trimmed;
			if (content.startsWith("- ")) content = content.substring(2);
			if (content.startsWith("`") && content.endsWith("`")) {
				content = content.slice(1, -1);
			}
			sections[currentKey].push(content);
		}
	});

	return sections;
};

const extractWarnings = (body: string) => {
	if (!body.includes("[!WARNING]")) return [];

	const warnings: string[] = [];
	const lines = body.split("\n");
	let isInsideWarningBlock = false;

	for (const line of lines) {
		const trimmed = line.trim();

		if (trimmed.includes("[!WARNING]")) {
			isInsideWarningBlock = true;
			continue;
		}

		if (isInsideWarningBlock) {
			if (trimmed.startsWith("> -") || trimmed.startsWith(">-")) {
				warnings.push(trimmed.replace(/^>\s*-\s*/, ""));
			} else if (!trimmed.startsWith(">")) {
				isInsideWarningBlock = false;
			}
		}
	}

	return warnings;
};

const SimpleMarkdownText = ({ text }: { text: string }) => {
	const parts = text.split(/(\[.*?\]\(.*?\))/g);
	return (
		<span>
			{parts.map((part, i) => {
				const match = part.match(/^\[(.*?)\]\((.*?)\)$/);
				if (match) {
					return (
						<a
							key={i}
							href={match[2]}
							target="_blank"
							rel="noopener noreferrer"
							style={{ textDecoration: "underline" }}
						>
							{match[1]}
						</a>
					);
				}
				return part;
			})}
		</span>
	);
};

const getPlatformUrl = (key: string, value: string) => {
	if (!value || !value.trim()) return null;

	switch (key) {
		case "ncmMusicId":
			return `https://music.163.com/#/song?id=${value}`;
		case "qqMusicId":
			return `https://y.qq.com/n/ryqq/songDetail/${value}`;
		case "spotifyId":
			return `https://open.spotify.com/track/${value}`;
		case "appleMusicId":
			return `https://music.apple.com/song/${value}`;
		case "ttmlAuthorGithubLogin":
			return `https://github.com/${value}`;
		case "isrc":
			return `https://isrcsearch.ifpi.org/?tab=%22code%22&isrcCode=%22${value}%22`;
		default:
			return null;
	}
};

interface PRInfoTabProps {
	pr: GitHubPR;
	repoUrl: string;
}

export const PRInfoTab = ({ pr, repoUrl }: PRInfoTabProps) => {
	const { warnings, botData, isBotFormat } = useMemo(() => {
		if (!pr.body) return { warnings: [], botData: {}, isBotFormat: false };
		return {
			warnings: extractWarnings(pr.body),
			botData: parseBotBody(pr.body),
			isBotFormat: pr.body.includes("### 歌词议题"),
		};
	}, [pr.body]);

	return (
		<Box p="5">
			{(() => {
				if (warnings.length > 0) {
					return (
						<Callout.Root color="red" style={{ marginBottom: "16px" }}>
							<Callout.Icon>
								<ExclamationTriangleIcon />
							</Callout.Icon>
							<Callout.Text>
								<Text weight="bold" as="div" mb="1">
									解析歌词文件时发现问题：
								</Text>
								<ul
									style={{
										margin: 0,
										paddingLeft: "20px",
										listStyleType: "disc",
									}}
								>
									{warnings.map((w, i) => (
										<li key={i}>{w}</li>
									))}
								</ul>
							</Callout.Text>
						</Callout.Root>
					);
				}
				return null;
			})()}

			{isBotFormat ? (
				(() => {
					const data = parseBotBody(pr.body);
					return (
						<Flex direction="column" gap="4">
							<Card>
								<Flex wrap="wrap" gap="5">
									<Box>
										<Text size="1" color="gray" weight="bold">
											关联 Issue
										</Text>
										{(() => {
											const issueRaw = botData.歌词议题?.[0];
											const issueNum = issueRaw?.replace("#", "");
											const issueUrl =
												issueNum && repoUrl
													? `${repoUrl}/issues/${issueNum}`
													: null;

											return issueUrl ? (
												<Flex align="center" gap="1">
													<a
														href={issueUrl}
														target="_blank"
														rel="noopener noreferrer"
														className={styles.animatedLink}
													>
														<Heading size="3" style={{ color: "inherit" }}>
															{issueRaw}
														</Heading>
														<ExternalLinkIcon width="14" height="14" />
													</a>
												</Flex>
											) : (
												<Heading size="3">{issueRaw || "无"}</Heading>
											);
										})()}
									</Box>

									<Box>
										<Text size="1" color="gray" weight="bold">
											歌词作者
										</Text>
										{(() => {
											const authorRaw = data.歌词作者?.[0];
											const authorLogin = authorRaw?.replace("@", "");
											const authorUrl = authorLogin
												? `https://github.com/${authorLogin}`
												: null;

											return authorUrl ? (
												<Flex align="center" gap="1">
													<a
														href={authorUrl}
														target="_blank"
														rel="noopener noreferrer"
														className={styles.animatedLink}
													>
														<Heading size="3" style={{ color: "inherit" }}>
															{authorRaw}
														</Heading>
														<ExternalLinkIcon width="14" height="14" />
													</a>
												</Flex>
											) : (
												<Heading size="3">{authorRaw || "未知"}</Heading>
											);
										})()}
									</Box>
								</Flex>
							</Card>

							<Card variant="classic">
								<Heading size="2" mb="2">
									基础元数据
								</Heading>

								<Flex direction="column" gap="4">
									<Box>
										<Flex align="center" gap="2" mb="1">
											<DiscIcon style={{ color: "var(--gray-10)" }} />
											<Text size="2" color="gray" weight="bold">
												音乐名称
											</Text>
										</Flex>
										<Flex gap="2" wrap="wrap">
											{data.音乐名称?.map((name, i) => (
												<Badge key={i} size="1" color="blue">
													{name}
												</Badge>
											))}
										</Flex>
									</Box>

									<Box>
										<Flex align="center" gap="2" mb="1">
											<PersonIcon style={{ color: "var(--gray-10)" }} />
											<Text size="2" color="gray" weight="bold">
												音乐作者
											</Text>
										</Flex>
										<Flex gap="2" wrap="wrap">
											{data.音乐作者?.map((artist, i) => (
												<Badge key={i} size="1" variant="soft" color="plum">
													{artist}
												</Badge>
											))}
										</Flex>
									</Box>

									<Box>
										<Flex align="center" gap="2" mb="1">
											<LayersIcon style={{ color: "var(--gray-10)" }} />
											<Text size="2" color="gray" weight="bold">
												音乐专辑
											</Text>
										</Flex>
										<Flex gap="2" wrap="wrap">
											{data.音乐专辑名称?.map((album, i) => (
												<Badge key={i} size="1" color="violet">
													{album}
												</Badge>
											))}
										</Flex>
									</Box>
								</Flex>
							</Card>

							<Card>
								<Heading size="2" mb="2">
									平台关联 ID
								</Heading>
								<Flex gap="4" wrap="wrap">
									{Object.keys(data)
										.filter((k) => k.includes("ID"))
										.map((key) => {
											const { Icon, label, color, internalKey } =
												getPlatformConfig(key);

											return (
												<Box key={key} style={{ minWidth: "160px" }}>
													<Flex align="center" gap="2" mb="2">
														<Icon
															width="20"
															height="20"
															style={{ color: color }}
														/>
														<Text size="2" weight="bold" color="gray">
															{label}
														</Text>
													</Flex>

													<Flex direction="column" gap="1" pl="1">
														{data[key].map((id, i) => {
															const url = getPlatformUrl(internalKey, id);

															return (
																<Flex key={i} align="center" gap="2">
																	{url ? (
																		<a
																			href={url}
																			target="_blank"
																			rel="noopener noreferrer"
																			className={styles.animatedLink}
																			style={{ marginLeft: "25px" }}
																		>
																			<Text size="2">{id}</Text>
																			<ExternalLinkIcon
																				width="12"
																				height="12"
																			/>
																		</a>
																	) : (
																		<Text
																			size="2"
																			style={{
																				marginLeft: "8px",
																			}}
																		>
																			{id}
																		</Text>
																	)}
																</Flex>
															);
														})}
													</Flex>
												</Box>
											);
										})}
								</Flex>
							</Card>

							{data.备注 && data.备注.length > 0 && (
								<Card>
									<Flex gap="2" align="start">
										<Box>
											<Heading size="2" mb="1">
												备注
											</Heading>
											<Flex direction="column" gap="1">
												{data.备注.map((note, i) => (
													<Text key={i} size="2" color="gray">
														<SimpleMarkdownText text={note} />
													</Text>
												))}
											</Flex>
										</Box>
									</Flex>
								</Card>
							)}
						</Flex>
					);
				})()
			) : pr.body && pr.body.trim() !== "" ? (
				<Card variant="surface">
					<Flex gap="3" align="start">
						<Flex direction="column" gap="1" style={{ width: "100%" }}>
							<Text
								size="2"
								style={{
									whiteSpace: "pre-wrap",
									wordBreak: "break-word",
									color: "var(--gray-11)",
									lineHeight: "1.5",
								}}
							>
								{pr.body}
							</Text>
						</Flex>
					</Flex>
				</Card>
			) : (
				<Text color="gray" style={{ fontStyle: "italic" }}>
					此 PR 没有任何内容
				</Text>
			)}
		</Box>
	);
};
