import { atomWithExtensionStorage } from "~lib/store";

export type PageExtractSettingItem = {
	enabled: boolean;
	defaultPlaceUid: string | undefined;
	defaultCategoryId: string | undefined;
	defaultGenreId: string | undefined;
};

const defaultPageExtractSettingItem: Readonly<PageExtractSettingItem> = {
	enabled: true,
	defaultPlaceUid: undefined,
	defaultCategoryId: undefined,
	defaultGenreId: undefined,
};

const createPageSettingAtom = ({
	key,
	url,
	description,
}: {
	key: string;
	url: string;
	description?: string;
}) => {
	return {
		key,
		url,
		description,
		atom: atomWithExtensionStorage<PageExtractSettingItem>(
			`extract-setting-${key}`,
			defaultPageExtractSettingItem,
		),
	};
};

export const extractSettingAtoms = [
	createPageSettingAtom({
		key: "amazon-gp-css-summary",
		url: "https://www.amazon.co.jp/gp/css/summary/print.html*",
		description: "Amazon.co.jp注文履歴の領収書/購入明細書",
	}),
	createPageSettingAtom({
		key: "amazon-gp-digital",
		url: "https://www.amazon.co.jp/gp/digital/your-account/order-summary.html*",
		description: "Amazon.co.jpデジタル注文履歴の領収書/購入明細書",
	}),
];

export type ExtractSettingAtom = (typeof extractSettingAtoms)[number]["atom"];
