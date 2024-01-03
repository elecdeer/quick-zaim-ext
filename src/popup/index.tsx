import { Loader, MantineProvider, createTheme } from "@mantine/core";
import "@mantine/core/styles.css";
import React, { Suspense } from "react";

import { Notifications } from "@mantine/notifications";

import { ExtensionPopup } from "./ExtensionPopup";

const theme = createTheme({});

export default function Popup() {
	return (
		<MantineProvider theme={theme}>
			<Suspense fallback={<Loader color="blue" />}>
				<ExtensionPopup />
			</Suspense>
			<Notifications position="bottom-right" m={16} />
		</MantineProvider>
	);
}
