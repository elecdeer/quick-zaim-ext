import {
	Combobox,
	Input,
	InputBase,
	ScrollArea,
	useCombobox,
} from "@mantine/core";
import { useStorage } from "@plasmohq/storage/hook";
import { useQuery } from "@tanstack/react-query";
import { type FC, useCallback, useMemo, useState } from "react";
import { recentlyGenreStore } from "~lib/store";
import { fetchZaimCategory } from "~lib/zaim/fetchCategory";
import { fetchZaimGenre } from "~lib/zaim/fetchGenre";

export type CategorySelectProps = {
	selectedGenreId: string | undefined;
	onSelect: (categoryId: string, genreId: string) => void;
};

const RECENTLY_USED_GENRE_LABEL = "最近選択したカテゴリ";
const RECENTLY_USED_GENRE_NUM = 5;

export const CategorySelect: FC<CategorySelectProps> = ({
	selectedGenreId,
	onSelect,
}) => {
	const [searchText, setSearchText] = useState("");
	const { recentlyUsedGenreIds, addRecentlyUsedGenre } =
		useRecentlyUsedGenreIds();

	const { data: genresData } = useQuery({
		queryKey: ["genres"],
		queryFn: async () => {
			return await fetchActivePaymentGenres();
		},
	});

	/**
	 * 最近選択したジャンルのデータ
	 */
	const recentlyUsedGenres = useMemo<ZaimGenre[]>(() => {
		if (!genresData) return [];
		return recentlyUsedGenreIds
			.map((genreId) => {
				const genre = genresData.find((genre) => genre.genreId === genreId);
				if (!genre) return null;
				return genre;
			})
			.filter((genre): genre is ZaimGenre => genre !== null);
	}, [genresData, recentlyUsedGenreIds]);

	const optionsElem = useMemo<JSX.Element>(() => {
		if (genresData === undefined) {
			return <Combobox.Empty>Loading...</Combobox.Empty>;
		}
		if (searchText === "") {
			const groups = sortAndGroupGenres(genresData);
			return (
				<>
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
					{groups.map((group) => (
						<Combobox.Group key={group.categoryId} label={group.categoryLabel}>
							{group.genres.map((genre) => (
								<Combobox.Option
									key={`${genre.genreId}`}
									value={`${group.categoryId}-${genre.genreId}`}
								>
									{genre.genreLabel}
								</Combobox.Option>
							))}
						</Combobox.Group>
					))}
				</>
			);
		}

		const filteredGenres = genresData.filter((genre) =>
			genre.genreLabel.toLowerCase().includes(searchText.toLowerCase().trim()),
		);
		const groups = sortAndGroupGenres(filteredGenres);

		return (
			<>
				{groups.map((group) => (
					<Combobox.Group key={group.categoryId} label={group.categoryLabel}>
						{group.genres.map((genre) => (
							<Combobox.Option
								key={`${genre.genreId}`}
								value={`${group.categoryId}-${genre.genreId}`}
							>
								{genre.genreLabel}
							</Combobox.Option>
						))}
					</Combobox.Group>
				))}
			</>
		);
	}, [genresData, recentlyUsedGenres, searchText]);

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
		(value: string) => {
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
		if (genresData === undefined || selectedGenreId === undefined)
			return undefined;

		const genre = genresData.find((genre) => genre.genreId === selectedGenreId);
		if (!genre) throw new Error("genre not found");

		return genre.genreLabel;
	}, [genresData, selectedGenreId]);

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
					rightSection={<Combobox.Chevron />}
					onClick={() => combobox.toggleDropdown()}
					rightSectionPointerEvents="none"
				>
					{selectedOptionLabel || (
						<Input.Placeholder>カテゴリ</Input.Placeholder>
					)}
				</InputBase>
			</Combobox.Target>

			<Combobox.Dropdown w={300}>
				<Combobox.Search
					value={searchText}
					onChange={(event) => setSearchText(event.currentTarget.value)}
					placeholder="Search"
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

const sortAndGroupGenres = (
	originalGenres: ZaimGenre[],
): {
	categoryId: string;
	categoryLabel: string;
	genres: {
		genreId: string;
		genreLabel: string;
	}[];
}[] => {
	const groupRecord = Object.groupBy(
		originalGenres,
		(genre) => genre.categoryId,
	);

	const sortedGroupEntries = Object.entries(groupRecord)
		.map<ZaimGenre[]>(([_, genres]) => genres as ZaimGenre[])
		.toSorted((a, b) => a[0].categorySort - b[0].categorySort)
		.map((genres) => {
			const category = genres[0];
			if (!category) throw new Error("category not found");

			return {
				categoryId: category.categoryId,
				categoryLabel: category.categoryLabel,
				genres: genres
					.toSorted((a, b) => a.genreSort - b.genreSort)
					.map((genre) => ({
						genreId: genre.genreId,
						genreLabel: genre.genreLabel,
					})),
			};
		});

	return sortedGroupEntries;
};

type ZaimGenre = {
	categoryId: string;
	categoryLabel: string;
	categorySort: number;
	genreId: string;
	genreLabel: string;
	genreSort: number;
};

const fetchActivePaymentGenres = async (): Promise<ZaimGenre[]> => {
	const [{ categories }, { genres }] = await Promise.all([
		fetchZaimCategory(),
		fetchZaimGenre(),
	]);

	return genres.reduce<ZaimGenre[]>((acc, genre) => {
		if (genre.active < 0) return acc;
		const category = categories.find(
			(category) => category.id === genre.category_id,
		);
		if (!category) return acc;
		if (category.active < 0) return acc;
		if (category.mode !== "payment") return acc;

		acc.push({
			categoryId: String(category.id),
			categoryLabel: category.name,
			categorySort: category.sort,
			genreId: String(genre.id),
			genreLabel: genre.name,
			genreSort: genre.sort,
		});

		return acc;
	}, []);
};

const useRecentlyUsedGenreIds = () => {
	const [recentlyUsedGenreIds, setRecentlyUsedGenreIds] = useStorage<string[]>(
		recentlyGenreStore.hookAccessor(),
		[],
	);

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

// https://github.com/microsoft/TypeScript/pull/56805
declare global {
	interface ObjectConstructor {
		/**
		 * Groups members of an iterable according to the return value of the passed callback.
		 * @param items An iterable.
		 * @param keySelector A callback which will be invoked for each item in items.
		 */
		groupBy<K extends PropertyKey, T>(
			items: Iterable<T>,
			keySelector: (item: T, index: number) => K,
		): Partial<Record<K, T[]>>;
	}
}
