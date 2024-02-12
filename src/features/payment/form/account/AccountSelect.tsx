import { Combobox, Input, InputBase, ScrollArea, Text } from "@mantine/core";
import { IconWallet } from "@tabler/icons-react";
import { useCallback, useMemo } from "react";

import { useComboboxWithFilterText } from "~lib/useComboboxWithFilterText";
import { type ZaimAccount, useAccountOptions } from "./useAccountOptions";

export type AccountSelectProps = {
	selectedAccountId: string | undefined;
	onSelect: (account: ZaimAccount) => void;
	label?: string | undefined;
};

export const AccountSelect: React.FC<AccountSelectProps> = ({
	selectedAccountId,
	onSelect,
	label,
}) => {
	const {
		combobox,
		filterText,
		handleChange,
		handleCompositionEnd,
		handleCompositionStart,
	} = useComboboxWithFilterText();

	const { filteredOptions, findSelectedAccount } = useAccountOptions({
		searchText: filterText,
	});

	const optionsElem = useMemo<JSX.Element>(() => {
		if (filteredOptions === undefined) {
			return <Combobox.Empty>Loading...</Combobox.Empty>;
		}

		return (
			<>
				{filteredOptions.map((item) => (
					<Combobox.Option value={item.accountId} key={item.accountId}>
						{item.name}
					</Combobox.Option>
				))}
			</>
		);
	}, [filteredOptions]);

	const selectedAccount = useMemo(() => {
		if (selectedAccountId === undefined) return undefined;
		return findSelectedAccount(selectedAccountId);
	}, [findSelectedAccount, selectedAccountId]);

	const handleOptionSubmit = useCallback(
		(selectedOptionId: string) => {
			const account = findSelectedAccount(selectedOptionId);
			if (account === undefined) throw new Error("account not found");
			onSelect(account);

			combobox.closeDropdown();
		},
		[findSelectedAccount, onSelect, combobox],
	);

	return (
		<Combobox
			store={combobox}
			withinPortal={false}
			onOptionSubmit={handleOptionSubmit}
			size="xs"
			offset={2}
		>
			<Combobox.Target>
				<InputBase
					component="button"
					type="button"
					pointer
					leftSectionPointerEvents="none"
					leftSection={<IconWallet size={20} />}
					rightSectionPointerEvents="none"
					rightSection={<Combobox.Chevron />}
					onClick={() => combobox.toggleDropdown()}
					label={label}
				>
					{selectedAccount ? (
						<Text span lineClamp={1} size="xs">
							{selectedAccount.name}
						</Text>
					) : (
						<Input.Placeholder>出金元</Input.Placeholder>
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
				/>
				<ScrollArea.Autosize type="scroll" mah={250}>
					<Combobox.Options>{optionsElem}</Combobox.Options>
				</ScrollArea.Autosize>
			</Combobox.Dropdown>
		</Combobox>
	);
};
