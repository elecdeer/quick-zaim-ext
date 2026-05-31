import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "extension-unit",
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "node",
  },
});
