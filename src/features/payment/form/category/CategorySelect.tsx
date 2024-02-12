import {
	Combobox,
	type ComboboxOptionProps,
	Input,
	InputBase,
	ScrollArea,
	useCombobox,
} from "@mantine/core";
import { useAtom } from "jotai";
import {
	type ChangeEventHandler,
	type FC,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import { flushSync } from "react-dom";
import { recentlyGenreAtom } from "../paymentFormAtoms";
import { type ZaimGenre, useCategoryOptions } from "./useCategoryOptions";

export type CategorySelectProps = {
	selectedGenreId: string | undefined;
	onSelect: (categoryId: string, genreId: string) => void;
	label?: string | undefined;
};

const RECENTLY_USED_GENRE_LABEL = "最近選択したカテゴリ";
const RECENTLY_USED_GENRE_NUM = 5;

export const CategorySelect: FC<CategorySelectProps> = ({
	selectedGenreId,
	onSelect,
	label,
}) => {
	//TODO: 2行になってはみ出るやつの対処

	const [searchText, setSearchText] = useState("");
	const { recentlyUsedGenreIds, addRecentlyUsedGenre } =
		useRecentlyUsedGenreIds();

	const { filteredGenreGroups, findSelectedCategory } = useCategoryOptions({
		searchText,
	});

	/**
	 * 最近選択したジャンルのデータ
	 */
	const recentlyUsedGenres = useMemo<ZaimGenre[]>(() => {
		return recentlyUsedGenreIds
			.map((genreId) => findSelectedCategory(genreId))
			.filter((genre): genre is ZaimGenre => genre !== undefined);
	}, [findSelectedCategory, recentlyUsedGenreIds]);

	const optionsElem = useMemo<JSX.Element>(() => {
		if (filteredGenreGroups === undefined) {
			return <Combobox.Empty>Loading...</Combobox.Empty>;
		}

		const recentlySelectedGroup = (
			<Combobox.Group label={RECENTLY_USED_GENRE_LABEL}>
				{recentlyUsedGenres.map((genre) => (
					<Combobox.Option
						key={`${genre.genreId}-recently`}
						value={`${genre.categoryId}-${genre.genreId}-recently`}
					>
						{genre.genreLabel}
					</Combobox.Option>
				))}
			</Combobox.Group>
		);

		return (
			<>
				{searchText === "" && recentlySelectedGroup}
				{filteredGenreGroups.map((group) => (
					<Combobox.Group key={group.categoryId} label={group.categoryLabel}>
						{group.genres.map((genre) => (
							<Combobox.Option
								key={genre.genreId}
								value={`${group.categoryId}-${genre.genreId}`}
							>
								{genre.genreLabel}
							</Combobox.Option>
						))}
					</Combobox.Group>
				))}
			</>
		);
	}, [filteredGenreGroups, recentlyUsedGenres, searchText]);

	const combobox = useCombobox({
		onDropdownClose: () => {
			combobox.resetSelectedOption();
			combobox.focusTarget();
			setSearchText("");
		},

		onDropdownOpen: () => {
			combobox.focusSearchInput();
		},
	});

	const handleOptionSubmit = useCallback(
		(value: string, optionProps: ComboboxOptionProps) => {
			const [categoryId, genreId] = value.split("-");
			if (categoryId !== "" && genreId !== "") {
				addRecentlyUsedGenre(genreId);
				onSelect(categoryId, genreId);
			}

			combobox.closeDropdown();
		},
		[addRecentlyUsedGenre, onSelect, combobox],
	);

	const selectedOptionLabel = useMemo(() => {
		if (filteredGenreGroups === undefined || selectedGenreId === undefined)
			return undefined;

		const genre = findSelectedCategory(selectedGenreId);
		if (!genre) throw new Error("genre not found");

		return genre.genreLabel;
	}, [filteredGenreGroups, findSelectedCategory, selectedGenreId]);

	const [isComposing, setIsComposing] = useState<boolean>(false);
	const handleChangeSearchText = useCallback<
		ChangeEventHandler<HTMLInputElement>
	>(
		(event) => {
			flushSync(() => {
				setSearchText(event.currentTarget.value);
			});

			console.log("onChange", event.currentTarget.value, isComposing);
			if (isComposing) {
				combobox.resetSelectedOption();
			} else {
				combobox.selectFirstOption();
				console.log("handleChangeSearchText selectFirstOption");
			}
		},
		[isComposing, combobox],
	);
	console.log(combobox.selectedOptionIndex);

	return (
		<Combobox
			store={combobox}
			withinPortal={false}
			onOptionSubmit={handleOptionSubmit}
			position="bottom-start"
			width={300}
			size="xs"
		>
			<Combobox.Target>
				<InputBase
					component="button"
					type="button"
					size="xs"
					pointer
					rightSectionPointerEvents="none"
					rightSection={<Combobox.Chevron />}
					onClick={() => combobox.toggleDropdown()}
					label={label}
				>
					{selectedOptionLabel || (
						<Input.Placeholder>カテゴリ</Input.Placeholder>
					)}
				</InputBase>
			</Combobox.Target>

			<Combobox.Dropdown w={300}>
				<Combobox.Search
					value={searchText}
					onChange={handleChangeSearchText}
					placeholder="Search"
					onCompositionStart={() => {
						setIsComposing(true);
					}}
					onCompositionEnd={() => {
						setIsComposing(false);
						combobox.selectFirstOption();
						console.log("onCompositionEnd selectFirstOption");
					}}
				/>
				<Combobox.Options>
					<ScrollArea.Autosize type="scroll" mah={250}>
						{optionsElem}
					</ScrollArea.Autosize>
				</Combobox.Options>
			</Combobox.Dropdown>
		</Combobox>
	);
};

const useRecentlyUsedGenreIds = () => {
	const [recentlyUsedGenreIds, setRecentlyUsedGenreIds] =
		useAtom(recentlyGenreAtom);

	const addRecentlyUsedGenre = (genreId: string) => {
		const newRecentlyUsedGenreIds = [
			genreId,
			...recentlyUsedGenreIds.filter((id) => id !== genreId),
		].slice(0, RECENTLY_USED_GENRE_NUM);
		void setRecentlyUsedGenreIds(newRecentlyUsedGenreIds);
	};

	return {
		recentlyUsedGenreIds,
		addRecentlyUsedGenre,
	};
};
