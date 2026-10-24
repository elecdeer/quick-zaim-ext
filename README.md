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

- `main` 以外のブランチに server 関連の変更を push すると、[Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/)（Cloudflare の GitHub 連携）が `wrangler preview` で Preview を作成・更新し、URL を PR コメントとダッシュボードに出す。GitHub 側に Cloudflare の API トークンは置かない
- ブランチを削除しても Preview は自動では消えない（上限を超えると最も古い Preview から自動削除される）。不要になったら `apps/server` で `pnpm exec wrangler preview delete --name <ブランチ名>` で消す
- ビルドを待たずにローカルから即デプロイする場合（Preview 名は現在の git ブランチ名になり、Workers Builds と同じ Preview を更新する）:

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

3. Cloudflare ダッシュボードで `quick-zaim-server` の Settings > Build から GitHub リポジトリを接続し、以下を設定する

| 設定                            | 値                                                                                              |
| ------------------------------- | ----------------------------------------------------------------------------------------------- |
| Git branch（production branch） | `main`                                                                                          |
| Root directory                  | 空（リポジトリのルート）                                                                        |
| Build command                   | `pnpm exec vp run @repo/zaim-api#generate`                                                      |
| Deploy command                  | `pnpm -F server exec wrangler versions upload`（本番への昇格は手動のまま）                      |
| Preview command                 | `pnpm -F server exec wrangler preview`                                                          |
| Branch control                  | Enable Preview Builds にチェック                                                                |
| Build watch paths（include）    | `apps/server/*`, `packages/zaim-api/*`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` |

- Root directory をリポジトリのルートにしているのは、ビルドイメージがルートの `pnpm-lock.yaml` と `packageManager` から pnpm workspace として依存をインストールできるようにするため。wrangler は `pnpm -F server exec` で `apps/server` から実行するので、`apps/server/wrangler.jsonc` が読まれる
- 接続済みの Worker で「Set up Worker Previews」バナーが出る場合は、Switch to Worker Previews に切り替える（Preview command を `wrangler preview` にするために必要）
