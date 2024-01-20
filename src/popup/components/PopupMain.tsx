import {
	ActionIcon,
	Button,
	Grid,
	NumberInput,
	Stack,
	Table,
	TextInput,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useStorage } from "@plasmohq/storage/hook";
import {
	IconCalendar,
	IconSquareMinusFilled,
	IconTextScan2,
} from "@tabler/icons-react";
import { type FC, useCallback, useState } from "react";
import type { AccessTokenPair } from "~lib/oauth";
import { oauthAccessTokenStore } from "~lib/store";
import { AccountSelect, type ZaimAccount } from "./AccountSelect";
import { CategorySelect } from "./CategorySelect";
import { PaymentPlaceSelect, type ZaimPlace } from "./PaymentPlaceSelect";
import { Unauthorized } from "./Unauthorized";

export const PopupMain: FC = () => {
	const [accessToken] = useStorage<AccessTokenPair | undefined>(
		oauthAccessTokenStore.hookAccessor(true),
	);

	if (accessToken === undefined) return <Unauthorized />;

	return <PopupMainAuthorized />;
};

const PopupMainAuthorized: FC = () => {
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

	const [selectedPaymentPlaceUid, setSelectedPaymentPlaceUid] = useState<
		string | null
	>(null);
	const handleSelectPaymentPlace = useCallback(({ placeUid }: ZaimPlace) => {
		setSelectedPaymentPlaceUid(placeUid);
	}, []);

	const [selectedAccountId, setSelectedAccountId] = useState<
		string | undefined
	>(undefined);
	const handleSelectAccount = useCallback(({ accountId }: ZaimAccount) => {
		setSelectedAccountId(accountId);
	}, []);

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
							<ActionIcon variant={"transparent"}>
								<IconSquareMinusFilled size={20} />
							</ActionIcon>
						</Table.Td>
					</Table.Tr>
				</Table.Tbody>
			</Table>
			<Stack px={4}>
				<PaymentPlaceSelect
					selectedPlaceUid={selectedPaymentPlaceUid}
					onSelect={handleSelectPaymentPlace}
				/>
				<Grid>
					<Grid.Col span={6}>
						<DateInput
							leftSection={<IconCalendar size={20} />}
							placeholder="日付"
							valueFormat="YYYY/MM/DD"
							monthLabelFormat="YYYY年M月"
							monthsListFormat="M月"
							weekdayFormat={(date) => "日月火水木金土"[date.getDay()]}
							onChange={(date) => {
								console.log(date);
							}}
						/>
					</Grid.Col>
					<Grid.Col span={6}>
						<AccountSelect
							selectedAccountId={selectedAccountId}
							onSelect={handleSelectAccount}
						/>
					</Grid.Col>
				</Grid>

				<Button variant="light">
					<IconTextScan2 size={20} />
					<span>ページから選択して入力</span>
				</Button>
				<Button variant="filled" fullWidth>
					登録
				</Button>
			</Stack>
		</Stack>
	);
};
