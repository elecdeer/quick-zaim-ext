import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
	input: "./tsp-output/@typespec/openapi3/openapi.yaml",
	output: "src/client",
  plugins: ['@hey-api/client-fetch'],
});
