import {
	Combobox,
	type ComboboxOptionProps,
	Input,
	InputBase,
	ScrollArea,
} from "@mantine/core";
import { useAtom } from "jotai";
import { type FC, useCallback, useMemo } from "react";
import { useComboboxWithFilterText } from "~lib/useComboboxWithFilterText";
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

	const {
		combobox,
		filterText,
		handleChange,
		handleCompositionEnd,
		handleCompositionStart,
	} = useComboboxWithFilterText();

	const { recentlyUsedGenreIds, addRecentlyUsedGenre } =
		useRecentlyUsedGenreIds();

	const { filteredGenreGroups, findSelectedCategory } = useCategoryOptions({
		searchText: filterText,
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
				{filterText === "" && recentlySelectedGroup}
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
	}, [filteredGenreGroups, recentlyUsedGenres, filterText]);

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
					value={filterText}
					placeholder="Search"
					onChange={handleChange}
					onCompositionStart={handleCompositionStart}
					onCompositionEnd={handleCompositionEnd}
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
