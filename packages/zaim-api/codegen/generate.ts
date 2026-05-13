import { CodeGenerator } from "@himenon/openapi-typescript-code-generator";
import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";
import { parse as parseYaml } from "yaml";
import { fetchClientGenerator } from "./generators/fetch-client.js";
import { mswHandlerGenerator } from "./generators/msw-handlers.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const specPath = path.resolve(__dirname, "../tsp-output/@typespec/openapi3/openapi.yaml");
const outDir = path.resolve(__dirname, "../src/generated");

// Parse YAML and resolve all internal $ref references inline.
// @himenon/openapi-typescript-code-generator does not support file-based
// component references when all components are defined inline in a single file.
function resolveRefs(
  root: Record<string, unknown>,
  current: unknown,
  visited = new WeakSet<object>(),
): unknown {
  if (typeof current !== "object" || current === null) return current;
  if (visited.has(current as object)) return current;
  visited.add(current as object);

  if (Array.isArray(current)) {
    return current.map((item) => resolveRefs(root, item, visited));
  }

  const record = current as Record<string, unknown>;
  if ("$ref" in record && typeof record["$ref"] === "string") {
    const ref = record["$ref"] as string;
    if (ref.startsWith("#/")) {
      const segments = ref.slice(2).split("/");
      let resolved: unknown = root;
      for (const seg of segments) {
        if (typeof resolved !== "object" || resolved === null) break;
        resolved = (resolved as Record<string, unknown>)[seg];
      }
      return resolveRefs(root, resolved, visited);
    }
  }

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    out[key] = resolveRefs(root, value, visited);
  }
  return out;
}

const specContent = fs.readFileSync(specPath, "utf8");
const rawSpec = parseYaml(specContent) as Record<string, unknown>;
const resolvedSpec = resolveRefs(rawSpec, rawSpec) as Record<string, unknown>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const codeGenerator = new CodeGenerator(resolvedSpec as any);

fs.mkdirSync(path.join(outDir, "client"), { recursive: true });
fs.mkdirSync(path.join(outDir, "msw"), { recursive: true });

fs.writeFileSync(path.join(outDir, "types.ts"), codeGenerator.generateTypeDefinition());
console.log("Generated: src/generated/types.ts");

fs.writeFileSync(
  path.join(outDir, "client/index.ts"),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  codeGenerator.generateCode([{ generator: fetchClientGenerator as any }]),
);
console.log("Generated: src/generated/client/index.ts");

fs.writeFileSync(
  path.join(outDir, "msw/index.ts"),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  codeGenerator.generateCode([{ generator: mswHandlerGenerator as any }]),
);
console.log("Generated: src/generated/msw/index.ts");

fs.writeFileSync(path.join(outDir, "index.ts"), 'export * from "./types.js";\n');
console.log("Generated: src/generated/index.ts");
