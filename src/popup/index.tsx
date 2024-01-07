import { Loader, MantineProvider, createTheme } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import React, { Suspense } from "react";
import { ExtensionPopup } from "./ExtensionPopup";

import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

dayjs.extend(customParseFormat);

const theme = createTheme({});

const queryClient = new QueryClient();

export default function Popup() {
	return (
		<MantineProvider theme={theme}>
			<Suspense fallback={<Loader color="blue" />}>
				<QueryClientProvider client={queryClient}>
					<ExtensionPopup />
				</QueryClientProvider>
			</Suspense>
			<Notifications position="bottom-right" m={16} />
		</MantineProvider>
	);
}
