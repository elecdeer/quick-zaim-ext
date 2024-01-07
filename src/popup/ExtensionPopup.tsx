import {
	ActionIcon,
	AppShell,
	Button,
	Flex,
	Grid,
	NumberInput,
	Select,
	Stack,
	Table,
	TextInput,
	Title,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useStorage } from "@plasmohq/storage/hook";
import {
	IconBuildingStore,
	IconCalendar,
	IconSettings,
	IconSquareMinusFilled,
	IconTextScan2,
	IconWallet,
} from "@tabler/icons-react";
import { type FC, useCallback, useState } from "react";
import { type AccessTokenPair } from "~lib/oauth";
import { OptionsPageUrl, openExtensionPage } from "~lib/runtime";
import {
	oauthAccessTokenStore,
	oauthConsumerKeyStore,
	oauthConsumerSecretStore,
} from "~lib/store";
import { CategorySelect } from "./components/CategorySelect";

export const ExtensionPopup: FC = () => {
	const onClickSettingButton = useCallback(() => {
		openExtensionPage(OptionsPageUrl).then(() => {
			// popupを閉じる
			window.close();
		});
	}, []);

	return (
		<AppShell
			mih={500}
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
	const [consumerKey] = useStorage<string | undefined>(
		oauthConsumerKeyStore.hookAccessor(true),
	);
	const [consumerSecret] = useStorage<string | undefined>(
		oauthConsumerSecretStore.hookAccessor(true),
	);
	const [accessToken] = useStorage<AccessTokenPair | undefined>(
		oauthAccessTokenStore.hookAccessor(true),
	);

	// TODO リストにする useListState
	const [selectedCategory, setSelectedCategory] = useState<{
		categoryId: string;
		genreId: string;
	} | null>(null);

	const handleSelectCategory = useCallback(
		(categoryId: string, genreId: string) => {
			setSelectedCategory({ categoryId, genreId });
		},
		[],
	);

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
							<CategorySelect
								selectedGenreId={selectedCategory?.genreId}
								onSelect={handleSelectCategory}
							/>
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
				<Select
					leftSection={<IconBuildingStore size={20} />}
					placeholder="お店"
				/>
				<Grid>
					<Grid.Col span={6}>
						<DateInput
							leftSection={<IconCalendar size={20} />}
							placeholder="日付"
							valueFormat="YYYY/MM/DD"
							monthLabelFormat="YYYY年MM月"
							weekdayFormat={(date) => "日月火水木金土"[date.getDay()]}
							onChange={(date) => {
								console.log(date);
							}}
						/>
					</Grid.Col>
					<Grid.Col span={6}>
						<Select
							leftSection={<IconWallet size={20} />}
							placeholder="出金元"
						/>
					</Grid.Col>
				</Grid>

				<Button variant="light" color="green">
					<IconTextScan2 size={20} />
					<span>ページから選択して入力</span>
				</Button>
				<Button variant="filled" color="green" fullWidth>
					登録
				</Button>
			</Stack>
		</Stack>
	);
};
