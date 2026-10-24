# Vite+ Monorepo Starter

A starter for creating a Vite+ monorepo.

## Development

- Check everything is ready:

```bash
vp run ready
```

- Run the tests:

```bash
vp run -r test
```

- Build the monorepo:

```bash
vp run -r build
```

- Run the development server:

```bash
vp run dev
```

## server の Preview 環境

ブランチごとに Cloudflare Workers の [Previews](https://developers.cloudflare.com/workers/previews/) を作り、本番に影響を与えずに実環境で動作確認できる。

- URL: `<ブランチ名をスラッグ化したもの>-quick-zaim-server.<subdomain>.workers.dev`
- KV は全 Preview 共通の Preview 専用ネームスペース、Auth0 は Preview 専用アプリを使う（`apps/server/wrangler.jsonc` の `previews` ブロック）
- ログ・トレースは Cloudflare ダッシュボードの各 Preview の Observability タブで見る（`wrangler tail` は Preview 非対応）
- Zaim アカウントは本番と同じなので、Preview から登録した支払いは実データに入る

### デプロイ

- `main` 以外のブランチに server 関連の変更を push すると、GitHub Actions（`.github/workflows/preview.yml`）が Preview を作成・更新し、URL を Job Summary と PR コメントに出す
- ブランチを削除すると Preview も削除される
- CI を待たずにローカルから即デプロイする場合（Preview 名は現在の git ブランチ名になり、CI と同じ Preview を更新する）:

```bash
vp run deploy:preview
```

拡張機能の設定オーバーレイでサーバー URL を Preview の URL に変更し、ログイン → Zaim 連携の順に行う（Zaim 連携は KV を共有しているので最初の 1 回だけでよい）。

### 初回セットアップ

1. Auth0 に Preview 専用の Regular Web Application を作り、以下を登録する
   - Allowed Callback URLs: `https://*.<subdomain>.workers.dev/callback`
   - Allowed Logout URLs: `https://*.<subdomain>.workers.dev/`
2. Preview 用シークレットを登録する（`apps/server` で実行。新しく作られる Preview にのみ反映されるので、最初の Preview を作る前に行う）

```bash
for name in OIDC_ISSUER OIDC_CLIENT_ID OIDC_CLIENT_SECRET OIDC_AUTH_SECRET ZAIM_CONSUMER_KEY ZAIM_CONSUMER_SECRET; do pnpm exec wrangler preview base-config secret put "$name"; done
```

3. Cloudflare API トークン（Workers Scripts: Edit と Workers KV Storage: Edit）を作り、GitHub リポジトリの Secrets に `CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` を登録する
