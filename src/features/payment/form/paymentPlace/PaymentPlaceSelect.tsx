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
import { type FC, useCallback, useMemo, useState } from "react";
import { useComboboxWithFilterText } from "~lib/useComboboxWithFilterText";
import {
	type ZaimPlace,
	usePaymentPlaceOptions,
} from "./usePaymentPlaceOptions";

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
	// TODO: 最近登録したお店は拡張側で持つ様にする？

	const {
		combobox,
		filterText,
		handleChange,
		handleCompositionEnd,
		handleCompositionStart,
	} = useComboboxWithFilterText();

	const [today] = useState(new Date());

	const [sortType, toggleSortType] = useToggle<"date" | "count">([
		"date",
		"count",
	]);
	const handleClickSortIcon = useCallback(() => {
		toggleSortType();
	}, [toggleSortType]);

	const { filteredOptions, findSelectedPlace } = usePaymentPlaceOptions({
		today,
		searchText: filterText,
		sortType,
	});

	const optionsElem = useMemo(() => {
		if (filteredOptions === undefined) {
			return <Skeleton height={8} />;
		}
		if (filteredOptions.length === 0) {
			return <Combobox.Empty>Nothing found</Combobox.Empty>;
		}

		return filteredOptions.map((item) => (
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
		));
	}, [filteredOptions]);

	const selectedOption = useMemo(() => {
		if (selectedPlaceUid === undefined) return undefined;
		return findSelectedPlace(selectedPlaceUid);
	}, [selectedPlaceUid, findSelectedPlace]);

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
					value={filterText}
					onChange={handleChange}
					onCompositionStart={handleCompositionStart}
					onCompositionEnd={handleCompositionEnd}
					placeholder="Search"
					rightSection={
						<ActionIcon
							onClick={handleClickSortIcon}
							size="sm"
							color={"green"}
							variant={sortType === "count" ? "filled" : "transparent"}
						>
							<IconSortDescendingNumbers size={16} />
						</ActionIcon>
					}
					rightSectionPointerEvents="auto"
				/>
				<Combobox.Options>
					<ScrollArea.Autosize type="scroll" mah={250}>
						{optionsElem}
					</ScrollArea.Autosize>
				</Combobox.Options>
			</Combobox.Dropdown>
		</Combobox>
	);
};
