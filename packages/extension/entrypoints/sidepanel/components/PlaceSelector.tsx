import {
	Combobox,
	ComboboxButton,
	ComboboxInput,
	ComboboxOption,
	ComboboxOptions,
} from "@headlessui/react";
import type { ZaimPlace } from "@repo/workers/client";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown } from "lucide-react";
import type { FC } from "react";
import { useState } from "react";
import { apiClient } from "../lib/api";

interface PlaceSelectorProps {
	value: string; // 店舗uid
	onChange: (place: { uid: string; name: string } | null) => void;
	placeholder?: string;
	className?: string;
}

export const PlaceSelector: FC<PlaceSelectorProps> = ({
	value,
	onChange,
	placeholder = "店舗名を選択してください",
	className = "",
}) => {
	const [shopNameQuery, setShopNameQuery] = useState("");

	// 店舗候補取得
	const placesQuery = useQuery({
		queryKey: ["places"],
		queryFn: async () => {
			const res = await apiClient.places.$get();
			if (res.ok) {
				const data = await res.json();
				if ("places" in data) {
					return data.places;
				}
				throw new Error("Invalid response format");
			}
			throw new Error(res.statusText);
		},
		staleTime: 5 * 60 * 1000, // 5分間キャッシュ
	});

	const places = placesQuery.data || [];

	// 使用回数順にソート
	const sortedPlaces = [...places].sort((a, b) => b.count - a.count);

	// 店舗名のフィルタリング
	const filteredPlaces = sortedPlaces.filter((place) =>
		place.name.toLowerCase().includes(shopNameQuery.toLowerCase()),
	);

	// 選択された店舗を取得
	const selectedPlace = places.find((place) => place.uid === value);

	return (
		<Combobox
			value={selectedPlace}
			onChange={(place: ZaimPlace | null) => {
				if (place) {
					onChange({ uid: place.uid, name: place.name });
				} else {
					onChange(null);
				}
			}}
		>
			<div className={`relative ${className}`}>
				<ComboboxButton as="div" className="w-full">
					<ComboboxInput
						className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
						displayValue={(place: ZaimPlace | null) => {
							if (place) return place.name;
							// valueがuidの場合、対応する店舗名を表示
							const foundPlace = places.find((p) => p.uid === value);
							return foundPlace?.name ?? "";
						}}
						onChange={(event) => setShopNameQuery(event.target.value)}
						placeholder={placeholder}
					/>
					<div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
						<ChevronDown className="h-4 w-4 text-gray-400" />
					</div>
				</ComboboxButton>
				<ComboboxOptions className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded border border-gray-300 bg-white shadow-lg">
					{(shopNameQuery === "" ? sortedPlaces : filteredPlaces).map(
						(place) => (
							<ComboboxOption
								key={place.uid}
								value={place}
								className="cursor-pointer select-none px-2 py-2 text-xs data-[focus]:bg-blue-100 data-[selected]:bg-blue-600 data-[selected]:text-white"
							>
								{({ selected }) => (
									<div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
										<div className="flex w-3 justify-center">
											{selected && <Check className="h-3 w-3" />}
										</div>
										<span
											className={`truncate ${selected ? "font-medium" : "font-normal"}`}
										>
											{place.name}
										</span>
										<span
											className={`text-right text-xs ${selected ? "text-blue-100" : "text-gray-500"}`}
										>
											{place.count}
										</span>
									</div>
								)}
							</ComboboxOption>
						),
					)}
					{shopNameQuery !== "" && filteredPlaces.length === 0 && (
						<div className="px-4 py-2 text-gray-500 text-sm">
							候補が見つかりません
						</div>
					)}
				</ComboboxOptions>
			</div>
		</Combobox>
	);
};
