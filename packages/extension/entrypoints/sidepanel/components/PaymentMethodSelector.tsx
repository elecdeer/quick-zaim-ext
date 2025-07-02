import {
	Combobox,
	ComboboxButton,
	ComboboxInput,
	ComboboxOption,
	ComboboxOptions,
} from "@headlessui/react";
import type { ZaimPaymentMethod } from "@repo/workers/client";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { Check, ChevronDown } from "lucide-react";
import type { FC } from "react";
import { useState } from "react";
import { apiClient } from "../lib/api";

interface PaymentMethodSelectorProps {
	value: string; // 支払い方法id
	onChange: (method: { id: number; name: string } | null) => void;
	placeholder?: string;
	className?: string;
}

export const PaymentMethodSelector: FC<PaymentMethodSelectorProps> = ({
	value,
	onChange,
	placeholder = "支払い方法を選択してください",
	className = "",
}) => {
	const [paymentMethodQuery, setPaymentMethodQuery] = useState("");

	// 支払い方法候補取得
	const paymentMethodsQuery = useQuery({
		queryKey: ["payment-methods"],
		queryFn: async () => {
			const res = await apiClient["payment-methods"].$get();
			if (res.ok) {
				const data = await res.json();
				if ("paymentMethods" in data) {
					return data.paymentMethods;
				}
				throw new Error("Invalid response format");
			}
			throw new Error(res.statusText);
		},
		staleTime: 5 * 60 * 1000, // 5分間キャッシュ
	});

	const paymentMethods = paymentMethodsQuery.data || [];

	// 支払い方法のフィルタリング
	const filteredPaymentMethods = paymentMethods.filter((method) =>
		method.name.toLowerCase().includes(paymentMethodQuery.toLowerCase()),
	);

	// 選択された支払い方法を取得
	const selectedPaymentMethod = paymentMethods.find(
		(method) => String(method.id) === value,
	);

	return (
		<Combobox
			value={selectedPaymentMethod}
			onChange={(method: ZaimPaymentMethod | null) => {
				if (method) {
					onChange({ id: method.id, name: method.name });
				} else {
					onChange(null);
				}
			}}
		>
			<div className={clsx("relative flex-1", className)}>
				<ComboboxButton as="div" className="w-full">
					<ComboboxInput
						className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
						displayValue={(method: ZaimPaymentMethod | null) => {
							if (method) return method.name;
							// valueがidの場合、対応する支払い方法名を表示
							const foundMethod = paymentMethods.find(
								(m) => String(m.id) === value,
							);
							return foundMethod?.name ?? "";
						}}
						onChange={(event) => {
							setPaymentMethodQuery(event.target.value);
						}}
						placeholder={placeholder}
					/>
					<div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
						<ChevronDown className="h-4 w-4 text-gray-400" />
					</div>
				</ComboboxButton>
				<ComboboxOptions className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded border border-gray-300 bg-white shadow-lg">
					{(paymentMethodQuery === ""
						? paymentMethods
						: filteredPaymentMethods
					).map((method) => (
						<ComboboxOption
							key={method.id}
							value={method}
							className="cursor-pointer select-none px-2 py-2 text-xs data-[focus]:bg-blue-100 data-[selected]:bg-blue-600 data-[selected]:text-white"
						>
							{({ selected }) => (
								<div className="grid grid-cols-[auto_1fr] items-center gap-2">
									<div className="flex w-3 justify-center">
										{selected && <Check className="h-3 w-3" />}
									</div>
									<span
										className={clsx(
											"truncate",
											selected ? "font-medium" : "font-normal",
										)}
									>
										{method.name}
									</span>
								</div>
							)}
						</ComboboxOption>
					))}
					{paymentMethodQuery !== "" && filteredPaymentMethods.length === 0 && (
						<div className="px-4 py-2 text-gray-500 text-sm">
							候補が見つかりません
						</div>
					)}
				</ComboboxOptions>
			</div>
		</Combobox>
	);
};
