import {
	ActionIcon,
	AppShell,
	Box,
	Button,
	Container,
	Flex,
	Stack,
	Title,
} from "@mantine/core";
import { IconSettings } from "@tabler/icons-react";
import { type FC, useCallback } from "react";
import {
	OptionsPageUrl,
	getExtensionUrl,
	openExtensionPage,
} from "~lib/runtime";

export const ExtensionPopup: FC = () => {
	const onClickSettingButton = useCallback(() => {
		openExtensionPage(OptionsPageUrl).then(() => {
			// popupを閉じる
			window.close();
		});
	}, []);

	return (
		<AppShell
			h={"min-height"}
			w={300}
			padding="xs"
			header={{
				height: 32,
			}}
		>
			<AppShell.Header bg={"green"} px={"xs"}>
				<Flex align={"center"} justify={"space-between"} h={"100%"}>
					<Title size={"h3"} c={"white"}>
						Quick Zaim Ext
					</Title>
					<ActionIcon
						onClick={onClickSettingButton}
						variant="transparent"
						color={"white"}
					>
						<IconSettings size={20} />
					</ActionIcon>
				</Flex>
			</AppShell.Header>
			<AppShell.Main>あああ</AppShell.Main>
		</AppShell>
	);
};
