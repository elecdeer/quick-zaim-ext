import {
	Button,
	Input,
	Modal,
	PasswordInput,
	Stack,
	TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useStorage } from "@plasmohq/storage/hook";
import { IconExternalLink } from "@tabler/icons-react";
import { type FC, useCallback, useRef, useState } from "react";
import {
	type AccessTokenPair,
	createOAuthApplicant,
	createOAuthSigner,
} from "~lib/oauth";
import {
	oauthAccessTokenStore,
	oauthConsumerKeyStore,
	oauthConsumerSecretStore,
} from "~lib/store";
import { usePromiseResolvers } from "~lib/usePromiseResolvers";

const zaimOAuthEndpoints = {
	accessTokenEndpoint: {
		url: "https://api.zaim.net/v2/auth/access",
		method: "GET",
	},
	requestTokenEndpoint: {
		url: "https://api.zaim.net/v2/auth/request",
		method: "GET",
	},
	authorizeEndpoint: {
		url: "https://auth.zaim.net/users/auth",
	},
} as const;

export const OptionsPage: FC = () => {
	// ready前はsuspendする
	const [consumerKey, setConsumerKey] = useStorage(
		oauthConsumerKeyStore.hookAccessor(true),
	);
	const [consumerSecret, setConsumerSecret] = useStorage(
		oauthConsumerSecretStore.hookAccessor(true),
	);

	const [accessToken, setAccessToken] = useStorage(
		oauthAccessTokenStore.hookAccessor(true),
	);

	const { openAuthorizeModal, modalElement } = useVerifyProcess({
		consumerKey,
		consumerSecret,
	});

	const handleClickUserAuthorize = useCallback(() => {
		void (async () => {
			const accessToken = await openAuthorizeModal();

			setAccessToken(accessToken);
		})();
	}, [openAuthorizeModal, setAccessToken]);

	const handleClickRequest = useCallback(() => {
		void (async () => {
			const oauthSign = createOAuthSigner({
				consumerKey,
				consumerSecret,
				accessToken: accessToken.accessToken,
				accessTokenSecret: accessToken.accessTokenSecret,
			});

			const { request, headers } = await oauthSign({
				url: "https://api.zaim.net/v2/home/user/verify",
				method: "GET",
				params: {},
			});

			const response = await fetch(request.url, {
				method: request.method,
				headers: headers,
			});

			const body = await response.json();
			console.log(body);
		})();
	}, [accessToken, consumerKey, consumerSecret]);

	return (
		<>
			<Stack p={16}>
				<PasswordInput
					label="Api Consumer Key"
					value={consumerKey ?? ""}
					onChange={(e) => {
						void setConsumerKey(e.currentTarget.value);
					}}
				/>

				<PasswordInput
					label="Api Consumer Secret"
					value={consumerSecret ?? ""}
					onChange={(e) => {
						void setConsumerSecret(e.currentTarget.value);
					}}
				/>

				<Button type="button" onClick={handleClickUserAuthorize}>
					Authorize
				</Button>

				<Button
					disabled={accessToken === undefined}
					type="button"
					onClick={handleClickRequest}
				>
					Request
				</Button>
			</Stack>
			{modalElement}
		</>
	);
};

const useVerifyProcess = ({
	consumerKey,
	consumerSecret,
}: {
	consumerKey: string;
	consumerSecret: string;
}) => {
	const [verifier, setVerifier] = useState<string>("");
	const [authorizeStarted, setAuthorizeStarted] = useState<boolean>(false);

	const [opened, { open, close }] = useDisclosure(false);

	const {
		wait: waitAuthorize,
		done: doneAuthorize,
		abort: abortAuthorize,
	} = usePromiseResolvers();

	const { wait: waitVerifyInput, done: doneVerifyInput } =
		usePromiseResolvers<string>();

	const openAuthorizeModal = useCallback(() => {
		if (consumerKey === "" || consumerSecret === "") return;

		setAuthorizeStarted(false);
		setVerifier("");
		open();
		return waitAuthorize();
	}, [open, consumerKey, consumerSecret, waitAuthorize]);

	const verifyCodeInputRef = useRef<HTMLInputElement>(null);
	const startAuthorize = useCallback(() => {
		setAuthorizeStarted(true);
		const { obtainAccessToken } = createOAuthApplicant({
			consumerKey,
			consumerSecret,
			...zaimOAuthEndpoints,
			waitUserAuthorize: (userAuthUrl) => {
				window.open(userAuthUrl, "zaimUserAuth");

				verifyCodeInputRef.current?.focus();

				return waitVerifyInput();
			},
		});

		obtainAccessToken()
			.then((token) => {
				close();
				doneAuthorize(token);
				notifications.show({
					message: "認証に成功しました！",
				});
			})
			.catch((e) => {
				close();
				abortAuthorize();
				console.error(e);
				notifications.show({
					message: "認証に失敗しました",
					color: "red",
				});
			});
	}, [
		consumerKey,
		consumerSecret,
		waitVerifyInput,
		doneAuthorize,
		close,
		abortAuthorize,
	]);

	const cancelAuthorizeProcess = useCallback(() => {
		abortAuthorize();
		close();
	}, [close, abortAuthorize]);
	const confirmVerifier = useCallback(() => {
		if (verifier === "") return;
		doneVerifyInput(verifier);
	}, [verifier, doneVerifyInput]);

	return {
		modalElement: (
			<Modal
				opened={opened}
				onClose={cancelAuthorizeProcess}
				title="User Authorize"
			>
				<Stack gap={16}>
					<Button
						onClick={startAuthorize}
						rightSection={<IconExternalLink size={14} />}
					>
						Open Authorize Page
					</Button>
					<TextInput
						ref={verifyCodeInputRef}
						disabled={!authorizeStarted}
						label={"Verify Code"}
						description={"「認証が完了」の下に表示されるコードを入力"}
						value={verifier}
						onChange={(e) => setVerifier(e.currentTarget.value)}
					/>
					<Button disabled={verifier === ""} onClick={confirmVerifier}>
						Confirm
					</Button>
				</Stack>
			</Modal>
		),
		openAuthorizeModal,
	};
};
