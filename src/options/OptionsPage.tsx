import { Button, Input, Stack, TextInput } from "@mantine/core";
import { useStorage } from "@plasmohq/storage/hook";
import { type FC, useCallback } from "react";
import { createOAuthApplicant, createOAuthSigner } from "~lib/oauth";
import {
	oauthAccessTokenStore,
	oauthConsumerKeyStore,
	oauthConsumerSecretStore,
} from "~lib/store";

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

	const handleClickUserAuthorize = useCallback(() => {
		const { obtainAccessToken } = createOAuthApplicant({
			consumerKey,
			consumerSecret,
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
			waitUserAuthorize: (userAuthUrl) => {
				console.log("waitUserAuthorize");
				console.log(userAuthUrl);

				const verifier = window.prompt("Enter the code from the browser", "");
				if (!verifier) {
					throw new Error("verifier is empty");
				}
				return Promise.resolve(verifier);
			},
		});

		void (async () => {
			const accessToken = await obtainAccessToken();

			setAccessToken(accessToken);
		})();
	}, [consumerKey, consumerSecret, setAccessToken]);

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
		<Stack p={16}>
			<Input.Wrapper label="Api Consumer Key">
				<Input
					value={consumerKey ?? ""}
					onChange={(e) => {
						void setConsumerKey(e.currentTarget.value);
					}}
				/>
			</Input.Wrapper>

			<Input.Wrapper label="Api Consumer Secret">
				<Input
					value={consumerSecret ?? ""}
					onChange={(e) => {
						void setConsumerSecret(e.currentTarget.value);
					}}
				/>
			</Input.Wrapper>

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
	);
};
