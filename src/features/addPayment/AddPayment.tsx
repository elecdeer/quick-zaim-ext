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
import {
	IconBarcode,
	IconCalendar,
	IconNote,
	IconSquareMinusFilled,
	IconTextScan2,
} from "@tabler/icons-react";
import { useAtomValue } from "jotai";
import { loadable } from "jotai/utils";
import { type FC, useCallback, useMemo, useReducer, useState } from "react";
import { oauthAccessTokenAtom } from "~features/authorize/authorizeAtoms";
import type { ExtractedOrder } from "~lib/service/extract/extractTypes";
import { type PaymentRecords, postPayments } from "~lib/service/payment";
import {
	createPaymentRequestFromFields,
	initialPaymentRecordFields,
	paymentRecordFieldsReducer,
} from "~lib/service/paymentRecordFieldsState";
import { Unauthorized } from "~popup/components/Unauthorized";
import { AccountSelect, type ZaimAccount } from "./form/AccountSelect";
import { CategorySelect } from "./form/CategorySelect";
import { PaymentPlaceSelect, type ZaimPlace } from "./form/PaymentPlaceSelect";

const oauthAccessTokenLoadableAtom = loadable(oauthAccessTokenAtom);

export const AddPayment: FC = () => {
	const oauthAccessToken = useAtomValue(oauthAccessTokenLoadableAtom);

	if (oauthAccessToken.state !== "hasData") return <Unauthorized />;

	return <PopupMainAuthorized />;
};

const PopupMainAuthorized: FC = () => {
	// TODO: 入力項目はstorageに保存するようにする？
	// TODO: "ACT"の部分をハンバーガーアイコンにして、メニューをいくつか用意する
	// 	今歯車アイコンになっている所をメニューにしても良いな

	const [paymentRecords, dispatchPaymentRecords] = useReducer(
		paymentRecordFieldsReducer,
		initialPaymentRecordFields,
	);

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
				dispatchPaymentRecords({ type: "reset" });
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
				dispatchPaymentRecords({
					type: "bulkSet",
					items: res.products.map((item) => ({
						itemName: item.productName,
						categoryAndGenre: undefined,
						price: item.priceYen,
						quantity: item.quantity,
					})),
				});
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
											dispatchPaymentRecords({
												type: "setItemName",
												index,
												itemName: event.currentTarget.value,
											});
										}}
									/>
								</Table.Td>
								<Table.Td>
									<CategorySelect
										selectedGenreId={item.categoryAndGenre?.genreId}
										onSelect={(categoryId, genreId) => {
											dispatchPaymentRecords({
												type: "setCategory",
												index,
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
											dispatchPaymentRecords({
												type: "setPrice",
												index,
												price: val === "" ? undefined : Number(val),
											});
										}}
									/>
								</Table.Td>
								<Table.Td>
									<NumberInput
										size="xs"
										value={item.quantity}
										onChange={(val) => {
											dispatchPaymentRecords({
												type: "setQuantity",
												index,
												quantity: val === "" ? 0 : Number(val),
											});
										}}
									/>
								</Table.Td>
								<Table.Td>
									<ActionIcon variant={"transparent"}>
										<IconSquareMinusFilled
											size={20}
											onClick={() => {
												dispatchPaymentRecords({
													type: "delete",
													index,
												});
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
