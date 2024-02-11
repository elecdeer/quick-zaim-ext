import { atomWithStorage } from "jotai/utils";
import { createJotaiStorageAdapter, extensionStorage } from "~lib/store";

export type ExtractSetting = {
	"amazon-gp-css-summary": {
		enabled: boolean;
		defaultPlaceUid: string | undefined;
		defaultCategoryId: string | undefined;
		defaultGenreId: string | undefined;
	};
};

export const extractSettingStore = atomWithStorage<ExtractSetting>(
	"extractSetting",
	{
		"amazon-gp-css-summary": {
			enabled: false,
			defaultPlaceUid: undefined,
			defaultCategoryId: undefined,
			defaultGenreId: undefined,
		},
	},
	createJotaiStorageAdapter<ExtractSetting>(extensionStorage),
	{ getOnInit: true },
);
