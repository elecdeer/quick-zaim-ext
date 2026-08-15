import { defineProject } from "vite-plus";

export default defineProject({
  test: {
    name: "zaim-api/unit",
    environment: "node",
  },
});
