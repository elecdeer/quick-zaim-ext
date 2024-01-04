import {
	ActionIcon,
	AppShell,
	Box,
	Button,
	Container,
	Flex,
	NumberInput,
	Select,
	Stack,
	Table,
	TextInput,
	Title,
} from "@mantine/core";
import {
	IconSettings,
	IconSquareMinus,
	IconSquareMinusFilled,
	IconTextScan2,
} from "@tabler/icons-react";
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
			w={560}
			// padding="xs"
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
			<AppShell.Main>
				<Main />
			</AppShell.Main>
		</AppShell>
	);
};

const Main: FC = () => {
	return (
		<Stack>
			<Table horizontalSpacing={4}>
				<Table.Thead>
					<Table.Tr>
						<Table.Th>品目</Table.Th>
						<Table.Th>カテゴリ</Table.Th>
						<Table.Th>金額</Table.Th>
						<Table.Th>Act</Table.Th>
					</Table.Tr>
				</Table.Thead>
				<Table.Tbody>
					<Table.Tr>
						<Table.Td>
							<TextInput size="xs" />
						</Table.Td>
						<Table.Td>
							<CategorySelect />
						</Table.Td>
						<Table.Td>
							<NumberInput size="xs" leftSection={"¥"} hideControls />
						</Table.Td>
						<Table.Td>
							<ActionIcon variant={"transparent"} color="green">
								<IconSquareMinusFilled size={20} />
							</ActionIcon>
						</Table.Td>
					</Table.Tr>
				</Table.Tbody>
			</Table>
			<Stack px={4}>
				<Select placeholder="出金元" />
				{/* DateInput */}
				<Select placeholder="お店" />

				<Button variant="light" color="green">
					<IconTextScan2 size={20} />
					ページから選択して入力
				</Button>
				<Button variant="filled" color="green" fullWidth>
					登録
				</Button>
			</Stack>

			<Box h={300} />
		</Stack>
	);
};

const CategorySelect: FC<{}> = () => {
	return (
		<Box>
			<Select
				placeholder="カテゴリ"
				searchable
				selectFirstOptionOnChange
				size="xs"
				comboboxProps={{
					position: "bottom-start",
					offset: 0,
					width: "300px",
				}}
				data={[
					{
						group: "Frontend",
						items: ["ReactReactReactReactReactReactReact", "Angular"],
					},
					{ group: "Backend", items: ["Express", "Django"] },
				]}
			/>
		</Box>
	);
};
