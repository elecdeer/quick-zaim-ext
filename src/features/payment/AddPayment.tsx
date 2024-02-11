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
import { atom, useAtomValue } from "jotai";
import { loadable } from "jotai/utils";
import { minimatch } from "minimatch";
import { type FC, useCallback, useMemo, useReducer, useState } from "react";
import { oauthAccessTokenAtom } from "~features/authorize/authorizeAtoms";
import { extractSettingAtoms } from "~features/extract/extractSettingStore";
import type { ExtractedOrder } from "~features/extract/extractTypes";
import { type PaymentRecords, postPayments } from "~features/payment/payment";
import {
	createPaymentRequestFromFields,
	initialPaymentRecordFields,
	paymentRecordFieldsReducer,
} from "~features/payment/paymentRecordFieldsState";
import { getCurrentTabUrl } from "~lib/runtime";
import { jotaiStore } from "~lib/store";
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

// Popupを開いた時点でのタブ
const currentTabAtom = atom(() => getCurrentTabUrl());

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
			...createPaymentRequestFromFields(paymentRecords, memoText),
			date: selectedDate,
			placeUid: selectedPaymentPlaceUid,
			fromAccountId: Number(selectedAccountId),
		};
	}, [
		paymentRecords,
		selectedAccountId,
		selectedDate,
		selectedPaymentPlaceUid,
		memoText,
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

	const currentUrl = useAtomValue(currentTabAtom);
	console.log("currentUrl", currentUrl);
	const extractPage = useMemo(() => {
		if (currentUrl === undefined) return undefined;
		return extractSettingAtoms.find((item) => {
			return minimatch(currentUrl, item.url);
		});
	}, [currentUrl]);
	console.log(extractPage);

	const handleClickAutoInput = useCallback(async () => {
		if (extractPage === undefined) return;

		console.log("extract from page");

		const setting = await jotaiStore.get(extractPage.atom);
		console.log("setting", setting);

		// if(!setting.enabled) return;

		const res: ExtractedOrder = await sendToContentScript({ name: "extract" });

		console.log("extracted", res);
		setSelectedDate(new Date(res.orderDate));
		setMemoText(res.orderNumber);

		// TODO: 上書きの確認？
		dispatchPaymentRecords({
			type: "bulkSet",
			items: res.products.map((item) => ({
				itemName: item.productName,
				categoryAndGenre: setting.defaultGenreAndCategoryId,
				price: item.priceYen,
				quantity: item.quantity,
			})),
		});

		if (setting.defaultAccountId !== undefined) {
			setSelectedAccountId(setting.defaultAccountId);
		}
		if (setting.defaultPlaceUid !== undefined) {
			setSelectedPaymentPlaceUid(setting.defaultPlaceUid);
		}
	}, [extractPage]);

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
						disabled={extractPage === undefined}
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
