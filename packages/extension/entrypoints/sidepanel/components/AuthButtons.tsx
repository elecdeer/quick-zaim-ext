import { Button } from "@headlessui/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import type { FC } from "react";
import { browser } from "wxt/browser";

import { apiClient } from "../lib/api";

export const LoginButton: FC = () => {
	const loginMutation = useMutation({
		mutationFn: async () => {
			const url = new URL("http://localhost:8787/login");
			url.searchParams.set(
				"return-to",
				"https://efpgpbmleoemnhndmngfoinonbmbibed.chromiumapp.org",
			);

			const res = await browser.identity.launchWebAuthFlow({
				interactive: true,
				url: url.toString(),
			});
			return res;
		},
		onSuccess: (data) => {
			console.log("Login success:", data);
		},
		onError: (error) => {
			console.error("Login error:", error);
		},
	});

	return (
		<Button
			onClick={() => loginMutation.mutate()}
			disabled={loginMutation.isPending}
			className="flex w-full items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 font-medium text-sm text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
		>
			{loginMutation.isPending ? "ログイン中..." : "ログイン"}
		</Button>
	);
};

export const ZaimLoginButton: FC = () => {
	const zaimLoginMutation = useMutation({
		mutationFn: async () => {
			const res = await apiClient.login.$post({
				query: {
					"return-to":
						"https://efpgpbmleoemnhndmngfoinonbmbibed.chromiumapp.org",
				},
			});
			const { userAuthorizeUrl } = await res.json();

			console.log({ userAuthorizeUrl });

			const res2 = await browser.identity.launchWebAuthFlow({
				interactive: true,
				url: userAuthorizeUrl,
			});
			return res2;
		},
		onSuccess: (data) => {
			console.log("Zaim login success:", data);
		},
		onError: (error) => {
			console.error("Zaim login error:", error);
		},
	});

	return (
		<Button
			onClick={() => zaimLoginMutation.mutate()}
			disabled={zaimLoginMutation.isPending}
			className="flex w-full items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 font-medium text-sm text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
		>
			{zaimLoginMutation.isPending ? "ログイン中..." : "Zaimログイン"}
		</Button>
	);
};

export const CategoriesButton: FC = () => {
	const categoriesQuery = useQuery({
		queryKey: ["categories"],
		queryFn: async () => {
			const res = await apiClient.categories.$get();

			console.log(res);

			if (res.ok) {
				const data = await res.json();
				console.log(data);
				return data;
			}
			throw new Error(res.statusText);
		},
		enabled: false, // 手動で実行
		staleTime: 5 * 60 * 1000, // 5分間キャッシュ
	});

	return (
		<Button
			onClick={() => categoriesQuery.refetch()}
			disabled={categoriesQuery.isFetching}
			className="flex w-full items-center justify-center gap-2 rounded bg-gray-600 px-3 py-2 font-medium text-sm text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-400"
		>
			{categoriesQuery.isFetching ? "取得中..." : "カテゴリ取得"}
		</Button>
	);
};

export const PlacesButton: FC = () => {
	const placesQuery = useQuery({
		queryKey: ["places-debug"],
		queryFn: async () => {
			const res = await apiClient.places.$get();

			console.log(res);

			if (res.ok) {
				const data = await res.json();
				console.log(data);
				return data;
			}
			throw new Error(res.statusText);
		},
		enabled: false, // 手動で実行
		staleTime: 5 * 60 * 1000, // 5分間キャッシュ
	});

	return (
		<Button
			onClick={() => placesQuery.refetch()}
			disabled={placesQuery.isFetching}
			className="flex w-full items-center justify-center gap-2 rounded bg-gray-600 px-3 py-2 font-medium text-sm text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-400"
		>
			{placesQuery.isFetching ? "取得中..." : "場所取得"}
		</Button>
	);
};

export const LogoutButton: FC = () => {
	const logoutMutation = useMutation({
		mutationFn: async () => {
			const url = new URL("http://localhost:8787/logout");
			const res = await fetch(url, {
				method: "GET",
			});
			console.log(res);
			return res;
		},
		onSuccess: (data) => {
			console.log("Logout success:", data);
		},
		onError: (error) => {
			console.error("Logout error:", error);
		},
	});

	return (
		<Button
			onClick={() => logoutMutation.mutate()}
			disabled={logoutMutation.isPending}
			className="flex w-full items-center justify-center gap-2 rounded bg-red-600 px-3 py-2 font-medium text-sm text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-400"
		>
			<LogOut className="h-4 w-4" />
			{logoutMutation.isPending ? "ログアウト中..." : "ログアウト"}
		</Button>
	);
};
