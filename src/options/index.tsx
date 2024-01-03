import { Loader, MantineProvider, createTheme } from "@mantine/core";
import "@mantine/core/styles.css";
import React, { Suspense, useEffect, useState } from "react";

import { Notifications } from "@mantine/notifications";
import { useStorage } from "@plasmohq/storage/hook";
import { oauthConsumerKeyStore } from "~lib/store";
import { OptionsPage } from "./OptionsPage";

const theme = createTheme({});

export default function Popup() {
	return (
		<MantineProvider theme={theme}>
			<Suspense fallback={<Loader color="blue" />}>
				<OptionsPage />
			</Suspense>
			<Notifications position="bottom-right" m={16} />
		</MantineProvider>
	);
}
