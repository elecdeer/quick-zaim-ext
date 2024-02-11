import { Accordion, Flex, Stack, Switch, Text } from "@mantine/core";
import { useAtom } from "jotai";
import type { FC } from "react";
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
				<Stack>
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

					<Text>Default Place: {extractSetting.defaultPlaceUid}</Text>
					<Text>Default Category: {extractSetting.defaultCategoryId}</Text>
					<Text>Default Genre: {extractSetting.defaultGenreId}</Text>
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
