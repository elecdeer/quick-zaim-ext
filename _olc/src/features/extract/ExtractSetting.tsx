import { Accordion, Stack } from "@mantine/core";
import type { FC } from "react";
import { extractSettingAtoms } from "./extractSettingStore";
import { ExtractPageSetting } from "./form/ExtractPageSetting";

export const ExtractSetting: FC = () => {
	return (
		<Stack>
			<Accordion chevronPosition="right" variant="contained">
				{extractSettingAtoms.map(({ key, url, description, atom }) => (
					<ExtractPageSetting
						key={key}
						itemKey={key}
						url={url}
						description={description}
						atom={atom}
					/>
				))}
			</Accordion>
		</Stack>
	);
};
