import { defineProject } from "vite-plus";

export default defineProject({
  test: {
    name: "extension/unit",
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "node",
  },
});
