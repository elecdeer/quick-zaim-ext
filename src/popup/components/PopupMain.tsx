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
import { showNotification } from "@mantine/notifications";
import { sendToContentScript } from "@plasmohq/messaging";
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
import type { ExtractedOrder } from "~lib/service/extract/extractTypes";
import { type PaymentRecords, postPayments } from "~lib/service/payment";
import {
	type PaymentRecordFieldItem,
	createPaymentRequestFromFields,
	initialPaymentRecordFields,
	paymentRecordFieldsReducer,
} from "~lib/service/paymentRecordFieldsState";
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
	// TODO: 入力項目はstorageに保存するようにする？
	// TODO: "ACT"の部分をハンバーガーアイコンにして、メニューをいくつか用意する
	// 	今歯車アイコンになっている所をメニューにしても良いな

	const [paymentRecords, setPaymentRecords] = useState<
		PaymentRecordFieldItem[]
	>(initialPaymentRecordFields);

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

	const paymentRequest = useMemo<PaymentRecords | undefined>(() => {
		if (selectedDate === undefined) return undefined;
		if (selectedAccountId === undefined) return undefined;

		return {
			...createPaymentRequestFromFields(paymentRecords),
			date: selectedDate,
			placeUid: selectedPaymentPlaceUid,
			fromAccountId: Number(selectedAccountId),
		};
	}, [
		paymentRecords,
		selectedAccountId,
		selectedDate,
		selectedPaymentPlaceUid,
	]);

	const isRegisterButtonActive =
		paymentRequest !== undefined && paymentRequest.items.length > 0;

	const handleClickRegister = useCallback(() => {
		if (paymentRequest === undefined) return;

		postPayments(paymentRequest, true)
			.then((res) => {
				setPaymentRecords((prev) =>
					paymentRecordFieldsReducer(prev, { type: "reset" }),
				);
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
	}, [paymentRequest]);

	const handleClickAutoInput = useCallback(() => {
		console.log("extract from page");
		void sendToContentScript({ name: "extract" }).then(
			(res: ExtractedOrder) => {
				console.log("extracted", res);
				setSelectedDate(new Date(res.orderDate));
				setMemoText(res.orderNumber);

				// TODO: 上書きの確認？
				setPaymentRecords((prev) =>
					paymentRecordFieldsReducer(prev, {
						type: "bulkSet",
						items: res.products.map((item) => ({
							itemName: item.productName,
							categoryAndGenre: undefined,
							price: item.priceYen,
							quantity: item.quantity,
						})),
					}),
				);
			},
		);
	}, []);

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
											setPaymentRecords((prev) =>
												paymentRecordFieldsReducer(prev, {
													type: "setItemName",
													index,
													itemName: event.currentTarget.value,
												}),
											);
										}}
									/>
								</Table.Td>
								<Table.Td>
									<CategorySelect
										selectedGenreId={item.categoryAndGenre?.genreId}
										onSelect={(categoryId, genreId) => {
											setPaymentRecords((prev) =>
												paymentRecordFieldsReducer(prev, {
													type: "setCategory",
													index,
													categoryId,
													genreId,
												}),
											);
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
											setPaymentRecords((prev) =>
												paymentRecordFieldsReducer(prev, {
													type: "setPrice",
													index,
													price: val === "" ? undefined : Number(val),
												}),
											);
										}}
									/>
								</Table.Td>
								<Table.Td>
									<NumberInput
										size="xs"
										value={item.quantity}
										onChange={(val) => {
											setPaymentRecords((prev) =>
												paymentRecordFieldsReducer(prev, {
													type: "setQuantity",
													index,
													quantity: val === "" ? 0 : Number(val),
												}),
											);
										}}
									/>
								</Table.Td>
								<Table.Td>
									<ActionIcon variant={"transparent"}>
										<IconSquareMinusFilled
											size={20}
											onClick={() => {
												setPaymentRecords((prev) =>
													paymentRecordFieldsReducer(prev, {
														type: "delete",
														index,
													}),
												);
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
						onClick={handleClickAutoInput}
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
