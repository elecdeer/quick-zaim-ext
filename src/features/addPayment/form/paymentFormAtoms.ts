import { atomWithExtensionStorage, keyPrefix } from "~lib/store";

export const recentlyGenreAtom = atomWithExtensionStorage<string[]>(
  `${keyPrefix}-recently-select-genre`,
  []
);

export const paymentPlacesAtom = atomWithExtensionStorage<string[]>(
  `${keyPrefix}-payment-places`,
  []
);
