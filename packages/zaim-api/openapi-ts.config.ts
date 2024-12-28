import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
	client: "@hey-api/client-fetch",
	input: "./tsp-output/@typespec/openapi3/openapi.yaml",
	output: "src/client",
});
