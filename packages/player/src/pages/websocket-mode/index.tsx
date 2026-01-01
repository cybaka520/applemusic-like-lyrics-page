import {
	Badge,
	Box,
	Button,
	Card,
	Flex,
	Heading,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useAtom, useAtomValue } from "jotai";
import { type FC, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../../components/PageContainer";
import {
	AppMode,
	appModeAtom,
	WebSocketConnectionStatus,
	wsConnectionStatusAtom,
	wsServerUrlAtom,
} from "../../states/appAtoms";

export const Component: FC = () => {
	const { t } = useTranslation();
	const [appMode, setAppMode] = useAtom(appModeAtom);
	const [serverUrl, setServerUrl] = useAtom(wsServerUrlAtom);
	const connectionStatus = useAtomValue(wsConnectionStatusAtom);

	const [inputValue, setInputValue] = useState(serverUrl);

	useEffect(() => {
		setInputValue(serverUrl);
	}, [serverUrl]);

	const isWsMode = appMode === AppMode.WebSocket;

	const handleConnect = () => {
		setServerUrl(inputValue);
		setAppMode(AppMode.WebSocket);
	};

	const handleDisconnect = () => {
		setAppMode(AppMode.Local);
	};

	const getStatusColor = (status: WebSocketConnectionStatus) => {
		switch (status) {
			case WebSocketConnectionStatus.Connected:
				return "green";
			case WebSocketConnectionStatus.Connecting:
				return "orange";
			case WebSocketConnectionStatus.Error:
				return "red";
			default:
				return "gray";
		}
	};

	const getStatusText = (status: WebSocketConnectionStatus) => {
		switch (status) {
			case WebSocketConnectionStatus.Connected:
				return t("amll.ws.status.connected", "已连接");
			case WebSocketConnectionStatus.Connecting:
				return t("amll.ws.status.connecting", "连接中...");
			case WebSocketConnectionStatus.Error:
				return t("amll.ws.status.error", "连接失败");
			case WebSocketConnectionStatus.Disconnected:
				return t("amll.ws.status.disconnected", "未连接");
			default:
				return status;
		}
	};

	return (
		<PageContainer>
			<Flex direction="column" gap="5" maxWidth="800px" mx="auto" mt="5">
				<Heading size="6">{t("amll.ws.title", "WS Protocol 模式")}</Heading>

				<Text color="gray" size="2">
					{t("amll.ws.description", "接收并显示来自其他应用的播放信息")}
				</Text>

				<Card size="3">
					<Flex direction="column" gap="4">
						<Flex justify="between" align="center">
							<Heading size="4">
								{t("amll.ws.connection_status", "连接状态")}
							</Heading>
							{isWsMode ? (
								<Badge
									color={getStatusColor(connectionStatus)}
									size="2"
									variant="soft"
								>
									{getStatusText(connectionStatus)}
								</Badge>
							) : (
								<Badge color="gray" size="2" variant="soft">
									{t("amll.ws.status.not_connected", "未连接")}
								</Badge>
							)}
						</Flex>

						<Box>
							<Text as="div" size="2" mb="2" weight="bold">
								{t("amll.ws.server_address", "服务器地址")}
							</Text>
							<Flex gap="3">
								<Box flexGrow="1">
									<TextField.Root
										value={inputValue}
										onChange={(e) => setInputValue(e.target.value)}
										placeholder="ws://localhost:11455"
										disabled={
											isWsMode &&
											connectionStatus === WebSocketConnectionStatus.Connected
										}
									/>
								</Box>
							</Flex>
						</Box>

						<Flex gap="3" justify="end" mt="2">
							{connectionStatus === WebSocketConnectionStatus.Connected ? (
								<Button color="red" variant="soft" onClick={handleDisconnect}>
									{t("amll.ws.action.disconnect", "断开连接")}
								</Button>
							) : (
								<Button onClick={handleConnect}>
									{t("amll.ws.action.connect", "连接")}
								</Button>
							)}

							{isWsMode &&
								connectionStatus !== WebSocketConnectionStatus.Connected &&
								connectionStatus !== WebSocketConnectionStatus.Disconnected &&
								connectionStatus !== WebSocketConnectionStatus.Connecting && (
									<Button
										variant="outline"
										onClick={() => {
											setServerUrl(inputValue);
										}}
									>
										{t("amll.ws.action.reconnect", "重新连接")}
									</Button>
								)}
						</Flex>
					</Flex>
				</Card>
			</Flex>
		</PageContainer>
	);
};

Component.displayName = "WebSocketModePage";
export default Component;
