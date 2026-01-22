import { CheckIcon, ExitIcon, PersonIcon } from "@radix-ui/react-icons";
import {
	Avatar,
	Box,
	Button,
	Callout,
	Dialog,
	Flex,
	Tabs,
	Text,
	TextArea,
	TextField,
} from "@radix-ui/themes";
import { useAtom } from "jotai";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { NeteaseClient } from "./services/netease-client";
import {
	isNeteaseLoggedInAtom,
	neteaseCookieAtom,
	neteaseUserAtom,
} from "./services/neteaseAtoms";

export const NeteaseLoginDialog = () => {
	const [cookie, setCookie] = useAtom(neteaseCookieAtom);
	const [user, setUser] = useAtom(neteaseUserAtom);
	const [isLoggedIn] = useAtom(isNeteaseLoggedInAtom);

	const [open, setOpen] = useState(false);
	const [loading, setLoading] = useState(false);

	const [phone, setPhone] = useState("");
	const [captcha, setCaptcha] = useState("");
	const [manualCookie, setManualCookie] = useState("");
	const [countdown, setCountdown] = useState(0);

	useEffect(() => {
		if (cookie && !user) {
			checkStatus(cookie);
		}
	}, [cookie]);

	useEffect(() => {
		if (countdown > 0) {
			const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
			return () => clearTimeout(timer);
		}
	}, [countdown]);

	const checkStatus = async (cookieStr: string) => {
		try {
			const profile = await NeteaseClient.auth.checkCookieStatus(cookieStr);
			setUser(profile);
		} catch (e) {
			console.error("Cookie 失效", e);
		}
	};

	const handleSendCaptcha = async () => {
		if (!phone) return toast.error("请输入手机号");
		setLoading(true);
		try {
			await NeteaseClient.auth.sendCaptcha(phone);
			toast.success("验证码已发送");
			setCountdown(60);
		} catch (e) {
			toast.error(`发送失败: ${(e as Error).message}`);
		} finally {
			setLoading(false);
		}
	};

	const handlePhoneLogin = async () => {
		if (!phone || !captcha) return toast.error("请填写完整");
		setLoading(true);
		try {
			const { cookie: newCookie, profile } =
				await NeteaseClient.auth.loginByPhone(phone, captcha);
			setCookie(newCookie);
			setUser(profile);
			toast.success(`欢迎回来，${profile.nickname}`);
			setOpen(false);
		} catch (e) {
			toast.error(`登录失败: ${(e as Error).message}`);
		} finally {
			setLoading(false);
		}
	};

	const handleCookieLogin = async () => {
		if (!manualCookie) return toast.error("请输入 Cookie");
		setLoading(true);
		try {
			const profile = await NeteaseClient.auth.checkCookieStatus(manualCookie);
			setCookie(manualCookie);
			setUser(profile);
			toast.success(`欢迎回来，${profile.nickname}`);
			setOpen(false);
		} catch (e) {
			toast.error(`Cookie 无效: ${(e as Error).message}`);
		} finally {
			setLoading(false);
		}
	};

	const handleLogout = () => {
		setCookie("");
		setUser(null);
		toast.info("已退出网易云登录");
		setOpen(false);
	};

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Trigger>
				<Button
					variant="ghost"
					color="gray"
					style={{
						width: "100%",
						justifyContent: "flex-start",
						padding: "20px 6px",
					}}
				>
					<Flex gap="3" align="center">
						{isLoggedIn && user ? (
							<>
								<Avatar
									src={user.avatarUrl}
									fallback={user.nickname[0]}
									size="3"
									radius="full"
									crossOrigin="anonymous"
								/>
								<Flex
									direction="column"
									align="start"
									style={{ overflow: "hidden" }}
								>
									<Text size="2" weight="bold" trim="end">
										{user.nickname}
									</Text>
								</Flex>
							</>
						) : (
							<>
								<Avatar
									fallback={<PersonIcon />}
									size="2"
									radius="full"
									color="gray"
									crossOrigin="anonymous"
								/>
								<Text size="2">未登录</Text>
							</>
						)}
					</Flex>
				</Button>
			</Dialog.Trigger>

			<Dialog.Content style={{ maxWidth: 400 }}>
				<Dialog.Title>登录</Dialog.Title>
				<Dialog.Description size="2" mb="4" color="gray">
					使用网易云音乐账户登录
				</Dialog.Description>

				{isLoggedIn && user ? (
					<Flex direction="column" gap="4" align="center" py="4">
						<Avatar
							src={user.avatarUrl}
							fallback={user.nickname[0]}
							size="6"
							radius="full"
							crossOrigin="anonymous"
						/>
						<Box>
							<Text align="center" as="div" weight="bold" size="4">
								{user.nickname}
							</Text>
							<Text align="center" as="div" color="gray" size="2">
								UID: {user.userId}
							</Text>
						</Box>

						{user.vipType === 11 && (
							<Callout.Root color="gold" size="1">
								<Callout.Icon>
									<CheckIcon />
								</Callout.Icon>
								<Callout.Text>您是尊贵的黑胶 VIP</Callout.Text>
							</Callout.Root>
						)}

						<Button
							color="red"
							variant="soft"
							onClick={handleLogout}
							style={{ marginTop: 16, width: "100%" }}
						>
							<ExitIcon /> 退出登录
						</Button>
					</Flex>
				) : (
					<Tabs.Root defaultValue="phone">
						<Tabs.List>
							<Tabs.Trigger value="phone">验证码登录</Tabs.Trigger>
							<Tabs.Trigger value="cookie">Cookie 登录</Tabs.Trigger>
						</Tabs.List>

						<Box pt="4">
							<Tabs.Content value="phone">
								<Flex direction="column" gap="3">
									<TextField.Root
										placeholder="手机号码"
										value={phone}
										onChange={(e) => setPhone(e.target.value)}
									>
										<TextField.Slot>
											<PersonIcon height="16" width="16" />
										</TextField.Slot>
									</TextField.Root>
									<Flex gap="2">
										<TextField.Root
											placeholder="验证码"
											value={captcha}
											onChange={(e) => setCaptcha(e.target.value)}
											style={{ flex: 1 }}
										/>
										<Button
											variant="soft"
											onClick={handleSendCaptcha}
											disabled={countdown > 0 || loading || !phone}
											style={{ minWidth: "100px" }}
										>
											{countdown > 0 ? `${countdown}s` : "发送"}
										</Button>
									</Flex>
									<Button onClick={handlePhoneLogin} disabled={loading} mt="2">
										{"登录"}
									</Button>
								</Flex>
							</Tabs.Content>

							<Tabs.Content value="cookie">
								<Flex direction="column" gap="3">
									<Callout.Root color="blue" size="1">
										<Callout.Text>
											格式为 MUSIC_U=...，可以在网易云网页中获取
										</Callout.Text>
									</Callout.Root>
									<TextArea
										placeholder="MUSIC_U=...;"
										rows={4}
										value={manualCookie}
										onChange={(e) => setManualCookie(e.target.value)}
									/>
									<Button onClick={handleCookieLogin} disabled={loading} mt="2">
										{loading ? "验证并登录" : "验证并登录"}
									</Button>
								</Flex>
							</Tabs.Content>
						</Box>
					</Tabs.Root>
				)}

				<Flex justify="end" mt="4">
					<Dialog.Close>
						<Button variant="soft" color="gray">
							关闭
						</Button>
					</Dialog.Close>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
};
