import {
	Combobox,
	Input,
	InputBase,
	ScrollArea,
	Text,
	useCombobox,
} from "@mantine/core";
import { IconWallet } from "@tabler/icons-react";
import { type ChangeEventHandler, useCallback, useMemo, useState } from "react";

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
	const [searchText, setSearchText] = useState("");
	const { filteredOptions, findSelectedAccount } = useAccountOptions({
		searchText,
	});

	const combobox = useCombobox({
		onDropdownClose: () => {
			combobox.resetSelectedOption();
			combobox.focusTarget();
			setSearchText("");
		},

		onDropdownOpen: () => {
			combobox.focusSearchInput();
		},
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

	const handleChangeSearchText = useCallback<
		ChangeEventHandler<HTMLInputElement>
	>(
		(event) => {
			setSearchText(event.currentTarget.value);
			combobox.selectFirstOption();
		},
		[combobox],
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
					value={searchText}
					onChange={handleChangeSearchText}
					placeholder="Search"
				/>
				<ScrollArea.Autosize type="scroll" mah={250}>
					<Combobox.Options>{optionsElem}</Combobox.Options>
				</ScrollArea.Autosize>
			</Combobox.Dropdown>
		</Combobox>
	);
};
