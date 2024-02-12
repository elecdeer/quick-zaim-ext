import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { fetchZaimAccount } from "~lib/zaimApi/fetchAccount";

export type ZaimAccount = {
	accountId: string;
	name: string;
	sort: number;
};

export const useAccountOptions = ({
	searchText,
}: {
	searchText: string;
}) => {
	const { data: accountsData } = useQuery({
		queryKey: ["accounts"],
		queryFn: fetchZaimAccount,
		select: (data) => {
			return data.accounts
				.filter((item) => item.active === 1)
				.map(
					(item) =>
						({
							accountId: String(item.id),
							name: item.name,
							sort: item.sort,
						}) satisfies ZaimAccount,
				);
		},
		throwOnError: true,
	});

	const filteredOptions = useMemo(() => {
		return accountsData
			?.filter((item) =>
				item.name.toLowerCase().includes(searchText.toLowerCase().trim()),
			)
			.toSorted((a, b) => a.sort - b.sort);
	}, [searchText, accountsData]);

	const findSelectedAccount = useCallback(
		(accountId: string) => {
			return accountsData?.find((item) => item.accountId === accountId);
		},
		[accountsData],
	);

	return {
		filteredOptions,
		findSelectedAccount,
	};
};
