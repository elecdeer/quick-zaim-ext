<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->

## Server (Hono) Coding Conventions

- **Query/body parameter parsing:** Always use `sValidator` from `@hono/standard-validator` with `valibot` schemas. Do not use `c.req.query()` or `c.req.json()` directly for validated input. Access validated values via `c.req.valid("query")` or `c.req.valid("json")`.

```ts
import { sValidator } from "@hono/standard-validator";
import * as v from "valibot";

const QuerySchema = v.object({
  foo: v.optional(v.string()),
});

app.get(
  "/path",
  sValidator("query", QuerySchema, (result, c) => {
    if (!result.success) return c.json({ error: "Invalid query parameters" }, 400);
  }),
  async (c) => {
    const { foo } = c.req.valid("query");
  },
);
```
