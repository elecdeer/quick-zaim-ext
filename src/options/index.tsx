import {
	AppShell,
	Flex,
	Loader,
	MantineProvider,
	Tabs,
	Title,
} from "@mantine/core";
import "@mantine/core/styles.css";
import React, { Suspense, useCallback, type FC } from "react";

import { useHash } from "@mantine/hooks";
import { Notifications } from "@mantine/notifications";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AddPayment } from "~features/payment/AddPayment";
import { appTheme } from "~lib/appTheme";

import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { Provider as JotaiProvider } from "jotai";
import { AuthorizeSetting } from "~features/authorize/AuthorizeSetting";
import { ExtractSetting } from "~features/extract/ExtractSetting";
import { jotaiStore } from "~lib/store";

dayjs.extend(customParseFormat);

const queryClient = new QueryClient();

export default function Index() {
	return (
		<JotaiProvider store={jotaiStore}>
			<MantineProvider theme={appTheme}>
				<QueryClientProvider client={queryClient}>
					<Options />
				</QueryClientProvider>
			</MantineProvider>
		</JotaiProvider>
	);
}

export const Options: FC = () => {
	const [activeTab, setActiveTab] = useHash();

	const handleChangeTab = useCallback(
		(tab: string | null) => {
			if (tab) {
				setActiveTab(tab);
			}
		},
		[setActiveTab],
	);

	return (
		<AppShell
			header={{
				height: 48 + 36, // header + tabs
			}}
		>
			<Tabs
				value={activeTab === "" ? "#authorize" : activeTab}
				onChange={handleChangeTab}
				color="green"
			>
				<AppShell.Header>
					<Header />
					<Tabs.List>
						<Tabs.Tab value={"#authorize"}>Authorize</Tabs.Tab>
						<Tabs.Tab value={"#payment"}>Payment</Tabs.Tab>
						<Tabs.Tab value={"#extract"}>Extract</Tabs.Tab>
					</Tabs.List>
				</AppShell.Header>
				<AppShell.Main mih="initial">
					<Tabs.Panel value={"#authorize"}>
						<Suspense fallback={<Loader color="green" />}>
							<AuthorizeSetting />
						</Suspense>
					</Tabs.Panel>

					<Tabs.Panel value={"#payment"}>
						<Suspense fallback={<Loader color="green" />}>
							<AddPayment />
						</Suspense>
					</Tabs.Panel>

					<Tabs.Panel value={"#extract"}>
						<Suspense fallback={<Loader color="green" />}>
							<ExtractSetting />
						</Suspense>
					</Tabs.Panel>

					<Notifications position="bottom-right" m={16} />
				</AppShell.Main>
			</Tabs>
		</AppShell>
	);
};

export const Header: FC = () => {
	return (
		<Flex
			align={"center"}
			justify={"space-between"}
			h={48}
			bg={"green"}
			px={12}
		>
			<Title size={"h3"} c={"white"}>
				Quick Zaim Ext
			</Title>
		</Flex>
	);
};
