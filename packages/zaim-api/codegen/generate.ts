import { CodeGenerator } from "@himenon/openapi-typescript-code-generator";
import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { fetchClientGenerator } from "./generators/fetch-client.js";
import { mswHandlerGenerator } from "./generators/msw-handlers.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const specPath = path.resolve(__dirname, "../tsp-output/@typespec/openapi3/openapi.yaml");
const outDir = path.resolve(__dirname, "../src/generated");

/**
 * Split a single-file OpenAPI YAML into the directory structure expected by
 * @himenon/openapi-typescript-code-generator:
 *
 *   openapi.split.yaml          <- entry (components removed, refs rewritten)
 *   components/
 *     parameters/<name>.yaml
 *     schemas/<name>.yaml
 *
 * The library can only resolve $ref when components live in separate files
 * under this structure. The split file lives next to the original in tsp-output/.
 */
// The library generates TypeScript identifiers from file names.
// TypeSpec uses dot-notation (e.g. "Account.Account") which is invalid in TS
// identifiers, so we replace dots with "$" — matching what the library does
// when processing inline component names in an object-based spec.
function toSafeFileName(name: string): string {
  return name.replaceAll(".", "$");
}

function splitSpec(rawSpec: Record<string, unknown>, specDir: string): string {
  const comps = (rawSpec.components ?? {}) as Record<string, Record<string, unknown>>;
  const supportedTypes = ["parameters", "schemas"] as const;

  for (const compType of supportedTypes) {
    const entries = comps[compType] ?? {};
    if (Object.keys(entries).length === 0) continue;

    const dir = path.join(specDir, "components", compType);
    fs.mkdirSync(dir, { recursive: true });

    for (const [name, value] of Object.entries(entries)) {
      fs.writeFileSync(path.join(dir, `${toSafeFileName(name)}.yaml`), stringifyYaml(value));
    }
  }

  // Rewrite #/components/TYPE/NAME → ./components/TYPE/SAFE_NAME.yaml and
  // remove the inline components section from the entry file.
  function rewriteRefs(obj: unknown): unknown {
    if (typeof obj !== "object" || obj === null) return obj;
    if (Array.isArray(obj)) return obj.map(rewriteRefs);

    const record = obj as Record<string, unknown>;
    if ("$ref" in record && typeof record["$ref"] === "string") {
      const match = (record["$ref"] as string).match(/^#\/components\/(parameters|schemas)\/(.+)$/);
      if (match) {
        return {
          $ref: `./components/${match[1]}/${toSafeFileName(match[2])}.yaml`,
        };
      }
    }

    return Object.fromEntries(Object.entries(record).map(([k, v]) => [k, rewriteRefs(v)]));
  }

  const { components: _components, ...specWithoutComponents } = rawSpec;
  const entrySpec = rewriteRefs(specWithoutComponents) as Record<string, unknown>;

  const entryPath = path.join(specDir, "openapi.split.yaml");
  fs.writeFileSync(entryPath, stringifyYaml(entrySpec));

  return entryPath;
}

const specContent = fs.readFileSync(specPath, "utf8");
const rawSpec = parseYaml(specContent) as Record<string, unknown>;
const specDir = path.dirname(specPath);
const entryPath = splitSpec(rawSpec, specDir);

const codeGenerator = new CodeGenerator(entryPath);

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
