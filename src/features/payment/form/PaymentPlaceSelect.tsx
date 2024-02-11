import {
	ActionIcon,
	Combobox,
	Grid,
	Input,
	InputBase,
	ScrollArea,
	Skeleton,
	Text,
	useCombobox,
} from "@mantine/core";
import { useToggle } from "@mantine/hooks";
import {
	IconBuildingStore,
	IconSortDescendingNumbers,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { type FC, useCallback, useMemo, useState } from "react";
import { fetchZaimMoney } from "~lib/zaimApi/fetchMoney";

type PaymentPlaceSelectProps = {
	selectedPlaceUid: string | undefined;
	onSelect: (value: ZaimPlace) => void;
	label?: string | undefined;
};

export const PaymentPlaceSelect: FC<PaymentPlaceSelectProps> = ({
	selectedPlaceUid,
	onSelect,
	label,
}) => {
	// TODO 最近登録したお店は拡張側で持つ様にする？

	const [today] = useState(new Date());

	const { data } = useQuery({
		queryKey: ["places"],
		queryFn: async () => {
			return await fetchPlaces(today);
		},
	});

	const [search, setSearch] = useState("");
	const combobox = useCombobox({
		onDropdownClose: () => {
			combobox.resetSelectedOption();
			combobox.focusTarget();
			setSearch("");
		},

		onDropdownOpen: () => {
			combobox.focusSearchInput();
		},
	});

	const filteredOptions = useMemo(
		() =>
			data?.filter((item) =>
				item.name.toLowerCase().includes(search.toLowerCase().trim()),
			),
		[data, search],
	);

	const [countSort, toggleCountSort] = useToggle([false, true]);
	const handleClickSortIcon = useCallback(() => {
		console.log("handleClickSortIcon");
		toggleCountSort();
	}, [toggleCountSort]);

	const options = useMemo(
		() =>
			filteredOptions
				?.toSorted((a, b) => {
					if (countSort) {
						return b.count - a.count;
					}
					return b.sortDate - a.sortDate;
				})
				.map((item) => (
					<Combobox.Option value={item.placeUid} key={item.placeUid}>
						<Grid px={8} py={8} justify="space-between" align="center">
							<Text span size="xs">
								{item.name}
							</Text>
							<Text span size="xs" c="gray">
								{item.count}件
							</Text>
						</Grid>
					</Combobox.Option>
				)),
		[countSort, filteredOptions],
	);

	const selectedOption = useMemo(() => {
		return filteredOptions?.find((item) => item.placeUid === selectedPlaceUid);
	}, [filteredOptions, selectedPlaceUid]);

	return (
		<Combobox
			store={combobox}
			withinPortal={false}
			onOptionSubmit={(val) => {
				const selected = filteredOptions?.find((item) => item.placeUid === val);
				if (selected !== undefined) {
					onSelect(selected);
				}
				combobox.closeDropdown();
			}}
			size={"xs"}
		>
			<Combobox.Target>
				<InputBase
					component="button"
					type="button"
					pointer
					leftSection={<IconBuildingStore size={20} />}
					rightSection={<Combobox.Chevron />}
					onClick={() => combobox.toggleDropdown()}
					rightSectionPointerEvents="none"
					label={label}
				>
					{selectedOption ? (
						<Text span lineClamp={1} size="xs">
							{selectedOption?.name}
						</Text>
					) : (
						<Input.Placeholder>お店</Input.Placeholder>
					)}
				</InputBase>
			</Combobox.Target>

			<Combobox.Dropdown>
				<Combobox.Search
					value={search}
					onChange={(event) => setSearch(event.currentTarget.value)}
					placeholder="Search"
					rightSection={
						<ActionIcon
							onClick={handleClickSortIcon}
							size="sm"
							color={"green"}
							variant={countSort ? "filled" : "transparent"}
						>
							<IconSortDescendingNumbers size={16} />
						</ActionIcon>
					}
					rightSectionPointerEvents="auto"
				/>
				<Combobox.Options>
					<ScrollArea.Autosize type="scroll" mah={250}>
						{options === undefined ? (
							<Skeleton height={8} />
						) : options.length > 0 ? (
							options
						) : (
							<Combobox.Empty>Nothing found</Combobox.Empty>
						)}
					</ScrollArea.Autosize>
				</Combobox.Options>
			</Combobox.Dropdown>
		</Combobox>
	);
};

export type ZaimPlace = {
	placeUid: string;
	name: string;
	count: number;
	accountId: string;
	sortDate: number;
};

const fetchPlaces = async (today: Date): Promise<ZaimPlace[]> => {
	const zaimMoneyRes = await fetchZaimMoney({
		mapping: 1,
	});

	const places = zaimMoneyRes.money.map((item) => ({
		placeUid: item.place_uid,
		name: item.place,
		accountId: String(item.from_account_id),
		receiptId: item.receipt_id,
		sortDate: new Date(item.date).getTime(),
	}));

	const deduplicatedPlaces = new Map<string, ZaimPlace>();
	const countedReceiptIds = new Set<number>();

	for (const place of places) {
		if (place.placeUid === "") continue;
		if (place.sortDate > today.getTime()) continue;
		if (countedReceiptIds.has(place.receiptId)) continue;

		const existingPlace = deduplicatedPlaces.get(place.placeUid);

		if (existingPlace) {
			existingPlace.count++;
			// より新しい日付の場合
			if (place.sortDate > existingPlace.sortDate) {
				existingPlace.sortDate = place.sortDate;
				existingPlace.accountId = String(place.accountId);
			}
		} else {
			deduplicatedPlaces.set(place.placeUid, {
				...place,
				count: 1,
			});
		}
		countedReceiptIds.add(place.receiptId);
	}

	return Array.from(deduplicatedPlaces.values());
};
