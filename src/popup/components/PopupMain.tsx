import {
	ActionIcon,
	Button,
	Grid,
	NumberInput,
	SimpleGrid,
	Stack,
	Table,
	TextInput,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useListState } from "@mantine/hooks";
import { showNotification } from "@mantine/notifications";
import { useStorage } from "@plasmohq/storage/hook";
import {
	IconBarcode,
	IconCalendar,
	IconSquareMinusFilled,
	IconTextScan2,
} from "@tabler/icons-react";
import { type FC, useCallback, useMemo, useState } from "react";
import { formatToYYYYMMDD } from "~lib/dateUtil";
import type { AccessTokenPair } from "~lib/oauth";
import { oauthAccessTokenStore } from "~lib/store";
import { type ZaimPaymentReq, postZaimPayment } from "~lib/zaim/postPayment";
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

type PaymentRecordItem = {
	uid: string;
	itemName: string;
	categoryId: string | undefined;
	genreId: string | undefined;
	price: number | undefined;
	amount: number;
};

type ValidRecordItem = {
	uid: string;
	itemName: string;
	categoryId: string;
	genreId: string;
	price: number;
	amount: number;
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

		console.log(validRecords);

		const date = new Date();
		const receiptId = Math.floor(date.getTime() / 1000); // ユニークなID

		const paymentReqPayloads = validRecords.map(
			(record) =>
				({
					mapping: 1,
					category_id: Number(record.categoryId),
					genre_id: Number(record.genreId),
					amount: (record.price ?? 0) * record.amount,
					date: formatToYYYYMMDD(date),
					from_account_id: Number(selectedAccountId),
					name: record.itemName,
					place_uid: selectedPaymentPlaceUid,
					receipt_id: receiptId,
					comment: "test",
				}) satisfies ZaimPaymentReq,
		);

		console.log({ paymentReqPayloads });

		Promise.all(paymentReqPayloads.map((payload) => postZaimPayment(payload)))
			.then((res) => {
				console.log("all posted");
				console.log({ res });

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
	}, [
		paymentRecordsController,
		selectedAccountId,
		selectedPaymentPlaceUid,
		validRecords,
	]);

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
