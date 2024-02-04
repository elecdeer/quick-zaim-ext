import {
	ActionIcon,
	Button,
	NumberInput,
	SimpleGrid,
	Stack,
	Table,
	TextInput,
	Textarea,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useListState } from "@mantine/hooks";
import { showNotification } from "@mantine/notifications";
import { useStorage } from "@plasmohq/storage/hook";
import {
	IconBarcode,
	IconCalendar,
	IconNote,
	IconSquareMinusFilled,
	IconTextScan2,
} from "@tabler/icons-react";
import { type FC, useCallback, useMemo, useState } from "react";
import type { AccessTokenPair } from "~lib/oauth";
import { postPayments } from "~lib/service/payment";
import { oauthAccessTokenStore } from "~lib/store";
import { type ZaimPaymentReq, postZaimPayment } from "~lib/zaimApi/postPayment";
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
	quantity: 1,
});

type PaymentRecordItem = {
	uid: string;
	itemName: string;
	categoryId: string | undefined;
	genreId: string | undefined;
	price: number | undefined;
	quantity: number;
};

type ValidRecordItem = {
	uid: string;
	itemName: string;
	categoryId: string;
	genreId: string;
	price: number;
	quantity: number;
};

const PopupMainAuthorized: FC = () => {
	// TODO: 入力項目はstorageに保存するようにする？
	// TODO: "ACT"の部分をハンバーガーアイコンにして、メニューをいくつか用意する
	// 	今歯車アイコンになっている所をメニューにしても良いな

	const [paymentRecords, paymentRecordsController] =
		useListState<PaymentRecordItem>([createDefaultRecord()]);

	const [selectedPaymentPlaceUid, setSelectedPaymentPlaceUid] = useState<
		string | undefined
	>(undefined);
	const [selectedAccountId, setSelectedAccountId] = useState<
		string | undefined
	>(undefined);
	const [selectedDate, setSelectedDate] = useState<Date | undefined>(
		new Date(),
	);
	const [memoText, setMemoText] = useState<string>("");

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

	const validRecords = useMemo(
		() =>
			paymentRecords.filter((record): record is ValidRecordItem => {
				if (record.itemName === "") return false;
				if (record.categoryId === undefined) return false;
				if (record.genreId === undefined) return false;
				if (record.price === undefined) return false;
				return true;
			}),
		[paymentRecords],
	);
	const isRegisterButtonActive =
		validRecords.length > 0 && selectedAccountId !== undefined;

	const handleClickRegister = useCallback(() => {
		if (selectedAccountId === undefined) return;

		const date = new Date();

		postPayments(
			{
				items: validRecords.map((record) => ({
					uid: record.uid,
					itemName: record.itemName,
					categoryId: Number(record.categoryId),
					genreId: Number(record.genreId),
					pricePerItem: record.price,
					quantity: record.quantity,
					memo: memoText,
				})),
				date,
				placeUid: selectedAccountId,
				fromAccountId: Number(selectedAccountId),
			},
			true,
		)
			.then((res) => {
				paymentRecordsController.setState([createDefaultRecord()]);
				showNotification({
					title: "登録完了",
					message: `${res.length}件の支出を登録しました`,
					color: "teal",
				});
			})
			.catch((err) => {
				console.error(err);
				showNotification({
					title: "登録失敗",
					message: "支出の登録に失敗しました",
					color: "red",
				});
			});
	}, [validRecords, selectedAccountId, paymentRecordsController, memoText]);

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
										value={item.quantity}
										onChange={(val) => {
											if (index === paymentRecords.length - 1) {
												appendRecord();
											}
											paymentRecordsController.setItemProp(
												index,
												"quantity",
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
				<Textarea
					value={memoText}
					onChange={(event) => setMemoText(event.currentTarget.value)}
					autosize
					minRows={1}
					placeholder="メモ"
					leftSection={<IconNote size={20} />}
					leftSectionPointerEvents="none"
				/>

				<PaymentPlaceSelect
					selectedPlaceUid={selectedPaymentPlaceUid}
					onSelect={handleSelectPaymentPlace}
				/>

				<SimpleGrid cols={2} spacing={"sm"}>
					<DateInput
						leftSection={<IconCalendar size={20} />}
						placeholder="日付"
						valueFormat="YYYY/MM/DD"
						monthLabelFormat="YYYY年M月"
						monthsListFormat="M月"
						weekdayFormat={(date) => "日月火水木金土"[date.getDay()]}
						required
						value={selectedDate}
						onChange={(date) => {
							if (date === null) return;
							setSelectedDate(date);
							console.log(date);
						}}
					/>
					<AccountSelect
						selectedAccountId={selectedAccountId}
						onSelect={handleSelectAccount}
					/>
				</SimpleGrid>

				<SimpleGrid cols={2} spacing={"sm"}>
					<Button variant="light" leftSection={<IconTextScan2 size={20} />}>
						ページから選択して入力
					</Button>
					<Button
						variant="light"
						disabled
						leftSection={<IconBarcode size={20} />}
					>
						ページから自動入力
					</Button>
				</SimpleGrid>

				<Button
					variant="filled"
					fullWidth
					onClick={handleClickRegister}
					disabled={!isRegisterButtonActive}
				>
					登録
				</Button>
			</Stack>
		</Stack>
	);
};
