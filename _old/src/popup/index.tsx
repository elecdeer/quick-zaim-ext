import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { Provider as JotaiProvider } from "jotai";
import React from "react";
import { appTheme } from "~lib/appTheme";
import { jotaiStore } from "~lib/store";
import { ExtensionPopup } from "./ExtensionPopup";

import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";

dayjs.extend(customParseFormat);

const queryClient = new QueryClient();

export default function Popup() {
	return (
		<JotaiProvider store={jotaiStore}>
			<MantineProvider theme={appTheme}>
				<QueryClientProvider client={queryClient}>
					<ExtensionPopup />
				</QueryClientProvider>
			</MantineProvider>
		</JotaiProvider>
	);
}
