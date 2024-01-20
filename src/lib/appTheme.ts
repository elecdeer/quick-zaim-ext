import { ActionIcon, Button, createTheme } from "@mantine/core";

export const appTheme = createTheme({
  components: {
    Button: Button.extend({
      defaultProps: {
        color: "green",
      },
    }),
    ActionIcon: ActionIcon.extend({
      defaultProps: {
        color: "green",
      },
    }),
  },
});
