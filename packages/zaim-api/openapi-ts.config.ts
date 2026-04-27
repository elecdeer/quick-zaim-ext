import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: "./tsp-output/@typespec/openapi3/openapi.yaml",
  output: "src/generated/",
  plugins: ["@hey-api/client-fetch", "@tanstack/react-query", "msw"],
});
