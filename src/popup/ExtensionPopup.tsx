import { AppShell, Loader } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { type FC, Suspense } from "react";
import { PopupHeader } from "./components/PopupHeader";
import { PopupMain } from "./components/PopupMain";

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
					<PopupMain />
				</Suspense>
				<Notifications position="bottom-right" m={16} />
			</AppShell.Main>
		</AppShell>
	);
};
