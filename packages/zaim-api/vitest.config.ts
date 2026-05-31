import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "zaim-api/unit",
    environment: "node",
    include: [],
  },
});
