import { Accordion, Flex, Input, Stack, Switch, Text } from "@mantine/core";
import { useAtom } from "jotai";
import type { FC } from "react";
import { AccountSelect } from "~features/payment/form/AccountSelect";
import { CategorySelect } from "~features/payment/form/CategorySelect";
import { PaymentPlaceSelect } from "~features/payment/form/PaymentPlaceSelect";
import type { ExtractSettingAtom } from "../extractSettingStore";

export type ExtractPageSettingProps = {
	itemKey: string;
	url: string;
	description: string | undefined;
	atom: ExtractSettingAtom;
};

export const ExtractPageSetting: FC<ExtractPageSettingProps> = ({
	itemKey,
	url,
	atom,
	description,
}) => {
	const [extractSetting, setExtractSetting] = useAtom(atom);

	return (
		<Accordion.Item value={itemKey}>
			<Accordion.Control bg={extractSetting.enabled ? "transparent" : "gray.3"}>
				<AccordionLabel itemKey={itemKey} url={url} description={description} />
			</Accordion.Control>
			<Accordion.Panel>
				<Stack py={8}>
					<Switch
						checked={extractSetting.enabled}
						onChange={(checked) => {
							setExtractSetting({
								...extractSetting,
								enabled: checked.currentTarget.checked,
							});
						}}
						label="Enabled"
					/>

					<PaymentPlaceSelect
						selectedPlaceUid={extractSetting.defaultPlaceUid}
						onSelect={(place) => {
							setExtractSetting({
								...extractSetting,
								defaultPlaceUid: place.placeUid,
							});
						}}
						label="デフォルトのお店"
					/>

					<AccountSelect
						selectedAccountId={extractSetting.defaultAccountId}
						onSelect={(account) => {
							setExtractSetting({
								...extractSetting,
								defaultAccountId: account.accountId,
							});
						}}
						label="デフォルトの出金元"
					/>

					<CategorySelect
						selectedGenreId={extractSetting.defaultGenreAndCategoryId?.genreId}
						onSelect={(categoryId, genreId) => {
							setExtractSetting({
								...extractSetting,
								defaultGenreAndCategoryId: {
									categoryId,
									genreId,
								},
							});
						}}
						label="デフォルトのカテゴリ"
					/>
				</Stack>
			</Accordion.Panel>
		</Accordion.Item>
	);
};

export const AccordionLabel: FC<{
	itemKey: string;
	url: string;
	description: string | undefined;
}> = ({ itemKey, url, description }) => {
	return (
		<Flex wrap="nowrap" direction="column">
			<Text>{itemKey}</Text>
			{description && (
				<Text size="sm" c="dimmed">
					{description}
				</Text>
			)}
			<Text size="sm" c="dimmed">
				{url}
			</Text>
		</Flex>
	);
};
