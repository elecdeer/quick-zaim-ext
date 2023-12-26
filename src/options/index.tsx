import { Loader, MantineProvider, createTheme } from "@mantine/core";
import "@mantine/core/styles.css";
import React, { Suspense, useEffect, useState } from "react";

import { useStorage } from "@plasmohq/storage/hook";
import { oauthConsumerKeyStore, waitSecureStorageReady } from "~lib/store";
import { OptionsPage } from "./OptionsPage";

const theme = createTheme({});

export default function Popup() {
	// waitSecureStorageReady();

	// const [isReadyStorage, setIsReadyStorage] = useState<boolean>(false);
	// useEffect(() => {
	// 	void (async () => {
	// 		await waitSecureStorageReady;
	// 		setIsReadyStorage(true);
	// 	})();
	// });

	return (
		<MantineProvider theme={theme}>
			<Suspense fallback={<Loader color="blue" />}>
				<OptionsPage />
			</Suspense>
		</MantineProvider>
	);
}
