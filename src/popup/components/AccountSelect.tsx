import {
	Combobox,
	Input,
	InputBase,
	ScrollArea,
	Text,
	useCombobox,
} from "@mantine/core";
import { IconWallet } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { fetchZaimAccount } from "~lib/zaim/fetchAccount";

export type AccountSelectProps = {
	selectedAccountId: string | undefined;
	onSelect: (account: ZaimAccount) => void;
};

export const AccountSelect: React.FC<AccountSelectProps> = ({
	selectedAccountId,
	onSelect,
}) => {
	const [searchText, setSearchText] = useState("");
	const { data: accountsData } = useQuery({
		queryKey: ["accounts"],
		queryFn: fetchAccounts,
		throwOnError: true,
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
		if (accountsData === undefined) {
			return <Combobox.Empty>Loading...</Combobox.Empty>;
		}

		const filteredOptions = accountsData
			.filter((item) =>
				item.name.toLowerCase().includes(searchText.toLowerCase().trim()),
			)
			.toSorted((a, b) => a.sort - b.sort);

		return (
			<>
				{filteredOptions.map((item) => (
					<Combobox.Option value={item.accountId} key={item.accountId}>
						{item.name}
					</Combobox.Option>
				))}
			</>
		);
	}, [accountsData, searchText]);

	const selectedAccount = useMemo(() => {
		if (accountsData === undefined) return undefined;
		return accountsData.find((item) => item.accountId === selectedAccountId);
	}, [accountsData, selectedAccountId]);

	const handleOptionSubmit = useCallback(
		(selectedOptionId: string) => {
			const account = accountsData?.find(
				(item) => item.accountId === selectedOptionId,
			);
			if (account === undefined) throw new Error("account not found");
			onSelect(account);

			combobox.closeDropdown();
		},
		[accountsData, onSelect, combobox],
	);

	return (
		<Combobox
			store={combobox}
			withinPortal={false}
			onOptionSubmit={handleOptionSubmit}
			size="xs"
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
					onChange={(event) => setSearchText(event.currentTarget.value)}
					placeholder="Search"
				/>
				<ScrollArea.Autosize type="scroll" mah={250}>
					<Combobox.Options>{optionsElem}</Combobox.Options>
				</ScrollArea.Autosize>
			</Combobox.Dropdown>
		</Combobox>
	);
};

export type ZaimAccount = {
	accountId: string;
	name: string;
	sort: number;
};

const fetchAccounts = async (): Promise<ZaimAccount[]> => {
	const zaimAccountRes = await fetchZaimAccount();

	return zaimAccountRes.accounts
		.filter((item) => item.active === 1)
		.map(
			(item) =>
				({
					accountId: String(item.id),
					name: item.name,
					sort: item.sort,
				}) satisfies ZaimAccount,
		);
};
