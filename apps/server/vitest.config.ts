import { defineProject } from "vite-plus";

export default defineProject({
  test: {
    name: "server/unit",
    environment: "node",
  },
});
