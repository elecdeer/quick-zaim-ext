import { defineConfig } from "@hey-api/openapi-ts";

import { defineConfig as defineMswPlugin } from "./src/msw-plugin/index.ts";

export default defineConfig({
  input: "./tsp-output/@typespec/openapi3/openapi.yaml",
  output: "src/generated/",
  plugins: ["@hey-api/client-fetch", defineMswPlugin()],
});
