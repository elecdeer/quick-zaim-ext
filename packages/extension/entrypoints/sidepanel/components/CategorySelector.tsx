import {
	Combobox,
	ComboboxButton,
	ComboboxInput,
	ComboboxOption,
	ComboboxOptions,
} from "@headlessui/react";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { Check, ChevronDown } from "lucide-react";
import type { FC } from "react";
import { useState } from "react";

// ZaimCategoryの型定義
type ZaimCategory = {
	id: number;
	name: string;
	subCategories: {
		id: number;
		name: string;
	}[];
};

import { apiClient } from "../lib/api";

interface CategorySelectorProps {
	value: string; // カテゴリIDの文字列
	onChange: (categoryId: string) => void;
	placeholder?: string;
	className?: string;
}

export const CategorySelector: FC<CategorySelectorProps> = ({
	value,
	onChange,
	placeholder = "カテゴリを選択",
	className = "",
}) => {
	const [categoryQuery, setCategoryQuery] = useState("");

	// カテゴリ候補取得
	const categoriesQuery = useQuery({
		queryKey: ["categories"],
		queryFn: async () => {
			const res = await apiClient.categories.$get();
			if (res.ok) {
				const data = await res.json();
				if ("categories" in data) {
					return data.categories;
				}
				throw new Error("Invalid response format");
			}
			throw new Error(res.statusText);
		},
		staleTime: 5 * 60 * 1000, // 5分間キャッシュ
	});

	const categories = categoriesQuery.data || [];

	// 選択されたサブカテゴリを取得
	const selectedSubCategory = categories
		.flatMap((cat) => cat.subCategories)
		.find((subCat) => String(subCat.id) === value);

	// カテゴリIDからサブカテゴリ名のみを取得
	const getSubCategoryName = (categoryId: string): string => {
		const subCategory = categories
			.flatMap((cat) => cat.subCategories)
			.find((subCat) => String(subCat.id) === categoryId);
		return subCategory?.name || "";
	};

	return (
		<Combobox
			value={selectedSubCategory}
			onChange={(selectedCategory: ZaimCategory["subCategories"][0] | null) => {
				if (selectedCategory && !("subCategories" in selectedCategory)) {
					// サブカテゴリが選択された場合
					onChange(String(selectedCategory.id));
				}
			}}
		>
			<div className={clsx("relative flex-1", className)}>
				<ComboboxButton as="div" className="w-full">
					<ComboboxInput
						className="w-full rounded border border-gray-300 px-1 py-0.5 text-sm focus:border-blue-500 focus:outline-none"
						displayValue={(
							selectedSubCategory: ZaimCategory["subCategories"][0] | null,
						) => {
							if (!selectedSubCategory) {
								// valueがあるが、selectedSubCategoryがない場合はIDから名前を取得
								return getSubCategoryName(value);
							}
							// サブカテゴリ名のみを表示（親カテゴリ名は表示しない）
							return selectedSubCategory.name;
						}}
						onChange={(event) => {
							setCategoryQuery(event.target.value);
						}}
						placeholder={placeholder}
					/>
					<div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-1">
						<ChevronDown className="h-3 w-3 text-gray-400" />
					</div>
				</ComboboxButton>
				<ComboboxOptions className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded border border-gray-300 bg-white shadow-lg">
					{categories
						.filter(
							(category) =>
								!categoryQuery ||
								category.name
									.toLowerCase()
									.includes(categoryQuery.toLowerCase()) ||
								category.subCategories.some((sub) =>
									sub.name.toLowerCase().includes(categoryQuery.toLowerCase()),
								),
						)
						.map((category) => (
							<div key={category.id}>
								{/* メインカテゴリ（選択不可、sticky） */}
								<div className="sticky top-0 z-10 flex items-center gap-2 bg-white px-2 py-1.5">
									<span className="font-normal text-gray-500 text-xs">
										{category.name}
									</span>
									<div className="h-px flex-1 bg-gray-200" />
								</div>
								{/* サブカテゴリ */}
								{category.subCategories
									.filter(
										(subCategory) =>
											!categoryQuery ||
											subCategory.name
												.toLowerCase()
												.includes(categoryQuery.toLowerCase()),
									)
									.map((subCategory) => (
										<ComboboxOption
											key={subCategory.id}
											value={subCategory}
											className="cursor-pointer select-none px-3 py-1 text-gray-600 text-xs data-[focus]:bg-blue-100 data-[selected]:bg-blue-600 data-[selected]:text-white"
										>
											{({ selected }) => (
												<div className="flex items-center gap-1">
													<div className="flex w-2 justify-center">
														{selected && <Check className="h-2 w-2" />}
													</div>
													<span className="truncate">{subCategory.name}</span>
												</div>
											)}
										</ComboboxOption>
									))}
							</div>
						))}
				</ComboboxOptions>
			</div>
		</Combobox>
	);
};
