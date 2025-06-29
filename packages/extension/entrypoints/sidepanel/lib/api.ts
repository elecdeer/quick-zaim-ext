import {
	createExtractionApiClient,
	createZaimApiClient,
} from "@repo/workers/client";
import { QueryClient } from "@tanstack/react-query";

// TODO: 環境変数などからベース URL を取得するようにする
export const apiClient = createZaimApiClient("http://localhost:8787");
export const extractionClient = createExtractionApiClient(
	"http://localhost:8787",
);

// QueryClient を作成
export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			retry: 1,
			refetchOnWindowFocus: false,
		},
		mutations: {
			retry: 1,
		},
	},
});
