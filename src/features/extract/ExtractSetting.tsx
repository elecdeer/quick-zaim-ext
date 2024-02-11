import { Switch } from "@mantine/core";
import { useAtom } from "jotai";
import type { FC } from "react";
import { extractSettingStore } from "./extractSettingStore";

export const ExtractSetting: FC = () => {
	const [extractSetting, setExtractSetting] = useAtom(extractSettingStore);

	return (
		<Switch
			checked={extractSetting["amazon-gp-css-summary"].enabled}
			onChange={(checked) => {
				setExtractSetting({
					...extractSetting,
					"amazon-gp-css-summary": {
						...extractSetting["amazon-gp-css-summary"],
						enabled: checked.currentTarget.checked,
					},
				});
			}}
			label="enable"
		/>
	);
};
