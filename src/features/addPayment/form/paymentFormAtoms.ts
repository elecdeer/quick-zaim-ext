import { atomWithExtensionStorage } from "~lib/store";

export const recentlyGenreAtom = atomWithExtensionStorage<string[]>(
	"recently-select-genre",
	[],
);

export const paymentPlacesAtom = atomWithExtensionStorage<string[]>(
	"payment-places",
	[],
);
