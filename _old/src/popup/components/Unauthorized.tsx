import { Button, Stack, Text, Title } from "@mantine/core";
import { IconExternalLink } from "@tabler/icons-react";
import { type FC, useCallback } from "react";
import { OptionsPageUrl, openExtensionPage } from "~lib/runtime";

export const Unauthorized: FC = () => {
	const onClickSettingButton = useCallback(() => {
		openExtensionPage(OptionsPageUrl).then(() => {
			// popupを閉じる
			window.close();
		});
	}, []);

	return (
		<Stack p={4}>
			<Text>ユーザ認証が必要です</Text>
			<Button
				onClick={onClickSettingButton}
				rightSection={<IconExternalLink size={14} />}
			>
				認証設定へ
			</Button>
		</Stack>
	);
};
