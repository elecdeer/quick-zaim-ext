# Toolchain

このプロジェクトは以下のツールを直接使用しています：

- **Vite** (`vite`) / **Vitest** (`vitest`) — ビルドとテスト
- **oxfmt** — フォーマット
- **oxlint** — リント
- **tsdown** — ライブラリバンドル（`packages/zaim-api`）
- **Turborepo** (`turbo`) — モノレポのタスクオーケストレーション（依存関係・キャッシュ）
- **Lefthook** — git pre-commit フック

## Review Checklist

- [ ] `pnpm install` を実行してから作業を開始する。
- [ ] `pnpm run ready` でフォーマット・リント・型チェック・テスト・ビルドをまとめて確認する。
- [ ] フォーマット単体: `oxfmt .`、リント単体: `oxlint .`
- [ ] テスト単体: `turbo run test`、型チェック単体: `turbo run check`
- [ ] 特定パッケージのみ実行: `turbo run test --filter=extension`

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
