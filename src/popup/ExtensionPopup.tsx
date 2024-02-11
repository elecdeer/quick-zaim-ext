import { AppShell, Loader } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { useAtom } from "jotai";
import { type FC, Suspense } from "react";
import { AddPayment } from "~features/payment/AddPayment";

import { jotaiStore } from "~lib/store";
import { PopupHeader } from "./components/PopupHeader";

export const ExtensionPopup: FC = () => {
	return (
		<AppShell
			mih={500}
			w={560}
			header={{
				height: 32,
			}}
		>
			<AppShell.Header bg={"green"} px={"xs"}>
				<PopupHeader />
			</AppShell.Header>
			{/* 100dvhがつけられてしまうので外す */}
			<AppShell.Main mih="initial">
				<Suspense fallback={<Loader color="blue" />}>
					<AddPayment />
				</Suspense>
				<Notifications position="bottom-right" m={16} />
			</AppShell.Main>
		</AppShell>
	);
};
