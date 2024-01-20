import { ActionIcon, Flex, Title } from "@mantine/core";
import { IconSettings } from "@tabler/icons-react";
import { type FC, useCallback } from "react";
import { OptionsPageUrl, openExtensionPage } from "~lib/runtime";

export const PopupHeader: FC = () => {
	const onClickSettingButton = useCallback(() => {
		openExtensionPage(OptionsPageUrl).then(() => {
			// popupを閉じる
			window.close();
		});
	}, []);

	return (
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
	);
};
