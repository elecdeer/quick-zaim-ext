import { useCombobox } from "@mantine/core";
import { type ChangeEventHandler, useCallback, useState } from "react";
import { flushSync } from "react-dom";

export const useComboboxWithFilterText = () => {
	const [isComposing, setIsComposing] = useState<boolean>(false);
	const [filterText, setFilterText] = useState("");

	const combobox = useCombobox({
		onDropdownClose: () => {
			combobox.resetSelectedOption();
			combobox.focusTarget();
			setFilterText("");
		},

		onDropdownOpen: () => {
			combobox.focusSearchInput();
		},
	});

	const handleChange = useCallback<ChangeEventHandler<HTMLInputElement>>(
		(event) => {
			// filterTextに対応した選択肢がマウントされてから選択肢を変更する必要がある
			flushSync(() => {
				setFilterText(event.currentTarget.value);
			});

			if (isComposing) {
				combobox.resetSelectedOption();
			} else {
				combobox.selectFirstOption();
			}
		},
		[isComposing, combobox],
	);
	const handleCompositionStart = useCallback(() => {
		setIsComposing(true);
	}, []);

	const handleCompositionEnd = useCallback(() => {
		setIsComposing(false);

		combobox.selectFirstOption();
	}, [combobox]);

	return {
		combobox,
		filterText,
		handleChange,
		handleCompositionStart,
		handleCompositionEnd,
	};
};
