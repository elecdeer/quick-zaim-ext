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
import { useListState } from "@mantine/hooks";
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

const createDefaultRecord = () => ({
	uid: crypto.randomUUID(),
	itemName: "",
	categoryId: undefined,
	genreId: undefined,
	price: undefined,
	amount: 1,
});

const PopupMainAuthorized: FC = () => {
	const [paymentRecords, paymentRecordsController] = useListState<{
		uid: string;
		itemName: string;
		categoryId: string | undefined;
		genreId: string | undefined;
		price: number | undefined;
		amount: number;
	}>([createDefaultRecord()]);

	const [selectedPaymentPlaceUid, setSelectedPaymentPlaceUid] = useState<
		string | undefined
	>(undefined);
	const [selectedAccountId, setSelectedAccountId] = useState<
		string | undefined
	>(undefined);

	const handleSelectPaymentPlace = useCallback(
		({ placeUid, accountId }: ZaimPlace) => {
			setSelectedPaymentPlaceUid(placeUid);

			if (selectedAccountId === undefined && accountId !== undefined) {
				setSelectedAccountId(accountId);
			}
		},
		[selectedAccountId],
	);

	const handleSelectAccount = useCallback(({ accountId }: ZaimAccount) => {
		setSelectedAccountId(accountId);
	}, []);

	const appendRecord = useCallback(() => {
		paymentRecordsController.append(createDefaultRecord());
	}, [paymentRecordsController]);

	return (
		<Stack>
			<Table horizontalSpacing={4}>
				<Table.Thead>
					<Table.Tr>
						<Table.Th w={250}>品目</Table.Th>
						<Table.Th w={150}>カテゴリ</Table.Th>
						<Table.Th w={100}>金額</Table.Th>
						<Table.Th w={70}>個数</Table.Th>
						<Table.Th>Act</Table.Th>
					</Table.Tr>
				</Table.Thead>
				<Table.Tbody>
					{paymentRecords.map((item, index) => {
						return (
							<Table.Tr key={item.uid}>
								<Table.Td>
									<TextInput
										size="xs"
										value={item.itemName}
										onChange={(event) => {
											if (index === paymentRecords.length - 1) {
												appendRecord();
											}
											paymentRecordsController.setItemProp(
												index,
												"itemName",
												event.currentTarget.value,
											);
										}}
									/>
								</Table.Td>
								<Table.Td>
									<CategorySelect
										selectedGenreId={item.genreId}
										onSelect={(categoryId, genreId) => {
											if (index === paymentRecords.length - 1) {
												appendRecord();
											}
											paymentRecordsController.setItem(index, {
												...item,
												categoryId,
												genreId,
											});
										}}
									/>
								</Table.Td>
								<Table.Td>
									<NumberInput
										size="xs"
										leftSection={"¥"}
										hideControls
										value={item.price ?? ""}
										onChange={(val) => {
											if (index === paymentRecords.length - 1) {
												appendRecord();
											}
											paymentRecordsController.setItemProp(
												index,
												"price",
												val === "" ? undefined : Number(val),
											);
										}}
									/>
								</Table.Td>
								<Table.Td>
									<NumberInput
										size="xs"
										value={item.amount}
										onChange={(val) => {
											if (index === paymentRecords.length - 1) {
												appendRecord();
											}
											paymentRecordsController.setItemProp(
												index,
												"amount",
												Number(val),
											);
										}}
									/>
								</Table.Td>
								<Table.Td>
									<ActionIcon variant={"transparent"}>
										<IconSquareMinusFilled
											size={20}
											onClick={() => {
												if (
													paymentRecords.length === 1 ||
													index === paymentRecords.length - 1
												) {
													paymentRecordsController.setItem(index, {
														...createDefaultRecord(),
													});
													return;
												}
												paymentRecordsController.remove(index);
											}}
										/>
									</ActionIcon>
								</Table.Td>
							</Table.Tr>
						);
					})}
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
