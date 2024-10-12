import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { fetchZaimCategory } from "~lib/zaimApi/fetchCategory";
import { fetchZaimGenre } from "~lib/zaimApi/fetchGenre";

export type ZaimGenre = {
	categoryId: string;
	categoryLabel: string;
	categorySort: number;
	genreId: string;
	genreLabel: string;
	genreSort: number;
};

export const useCategoryOptions = ({
	searchText,
}: {
	searchText: string;
}): {
	filteredGenreGroups: CategoryAndGenreGroup[] | undefined;
	findSelectedCategory: (genreId: string) => ZaimGenre | undefined;
} => {
	const { data: genresData } = useQuery({
		queryKey: ["genres"],
		queryFn: async () => {
			return await fetchActivePaymentGenres();
		},
		throwOnError: true,
	});

	const filteredGenres = useMemo(() => {
		if (genresData === undefined) return undefined;

		const filtered = genresData.filter((genre) =>
			genre.genreLabel.toLowerCase().includes(searchText.toLowerCase().trim()),
		);

		return sortAndGroupGenres(filtered);
	}, [genresData, searchText]);

	const findSelectedCategory = useCallback(
		(genreId: string) => {
			return genresData?.find((genre) => genre.genreId === genreId);
		},
		[genresData],
	);

	return {
		filteredGenreGroups: filteredGenres,
		findSelectedCategory,
	};
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

export type CategoryAndGenreGroup = {
	categoryId: string;
	categoryLabel: string;
	genres: {
		genreId: string;
		genreLabel: string;
	}[];
};

const sortAndGroupGenres = (
	originalGenres: ZaimGenre[],
): CategoryAndGenreGroup[] => {
	const groupRecord = Object.groupBy(
		originalGenres,
		(genre) => genre.categoryId,
	);

	return Object.entries(groupRecord)
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
