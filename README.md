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
- KV は全 Preview 共通の Preview 専用ネームスペースを使う（`apps/server/wrangler.jsonc` の `previews` ブロック）
- 認証は Worker の手前の Cloudflare Access が行い、Preview URL もまとめて保護される
- ログ・トレースは Cloudflare ダッシュボードの各 Preview の Observability タブで見る（`wrangler tail` は Preview 非対応）
- Zaim アカウントは本番と同じなので、Preview から登録した支払いは実データに入る
- Zaim は Preview 専用の Zaim アプリの鍵を使う。Zaim はコールバック URL のドメインをアプリのサービス URL と照合するため、どの Preview から Zaim 連携を始めてもコールバックは固定の Preview `zaim-connect` で受ける（`previews.vars` の `ZAIM_OAUTH_CALLBACK_ORIGIN`）

### デプロイ

- `main` 以外のブランチに server 関連の変更を push すると、[Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/)（Cloudflare の GitHub 連携）が `wrangler preview` で Preview を作成・更新し、URL を PR コメントとダッシュボードに出す。GitHub 側に Cloudflare の API トークンは置かない
- ブランチを削除しても Preview は自動では消えない（上限を超えると最も古い Preview から自動削除される）。不要になったら `pnpm -F server exec wrangler preview delete --name <ブランチ名>` で消す
- ビルドを待たずにローカルから即デプロイする場合（Preview 名は現在の git ブランチ名になり、Workers Builds と同じ Preview を更新する）:

```bash
vp run deploy:preview
```

拡張機能の設定オーバーレイでサーバー URL を Preview の URL に変更し、ログイン → Zaim 連携の順に行う（Zaim 連携は KV を共有しているので最初の 1 回だけでよい）。

### 初回セットアップ

1. Cloudflare Access で Worker を保護する（下の「認証（Cloudflare Access）」を参照）
2. [Zaim Developers](https://dev.zaim.net/) で Preview 専用のアプリを作り、サービスの URL を `https://zaim-connect-quick-zaim-server.<subdomain>.workers.dev` にする
3. Preview 用シークレットに Preview 専用 Zaim アプリの Consumer Key / Secret を登録する（新しく作られる Preview にのみ反映されるので、Preview を作る前に行う。既存の Preview には `pnpm -F server exec wrangler preview secret put <NAME> --name <ブランチ名>` で個別に入れる）

```bash
for name in ZAIM_CONSUMER_KEY ZAIM_CONSUMER_SECRET; do pnpm -F server exec wrangler preview base-config secret put "$name"; done
```

4. コールバックを受ける固定の Preview `zaim-connect` を作る（Zaim 連携のコールバックを処理できるコードであれば、どのブランチから作ってもよい）

```bash
pnpm -F server exec wrangler preview --name zaim-connect
```

5. Cloudflare ダッシュボードで `quick-zaim-server` の Settings > Build から GitHub リポジトリを接続し、以下を設定する

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

## 認証（Cloudflare Access）

server へのログインとセッション管理は Worker の手前の [Cloudflare Access](https://developers.cloudflare.com/workers/configuration/cloudflare-access/) が行う。Worker は Access が付与する `ctx.access` からユーザー（メールアドレス）を取り出し、取れなければ Access が付ける `Cf-Access-Jwt-Assertion` をチームの公開鍵と AUD で検証して取り出す。どちらでも取れなければ 401 を返す。

- Preview URL へのリクエストでは Access を通過していても `ctx.access` が渡らないことがあるため、JWT 検証で補っている（どちらで認証したか、401 の理由はログに出る）
- JWT 検証には `ACCESS_TEAM_DOMAIN` と `ACCESS_AUD`（Worker の Access タブで有効にした Access アプリケーションの AUD タグ）を vars に設定する。Preview 用は `apps/server/wrangler.jsonc` の `previews.vars` に設定済み。本番の Access を有効にしたら、本番用の AUD をトップレベルの `vars` に追加する

- 拡張機能は Access のセッション Cookie（`CF_Authorization`）を送り、未ログイン時の Access ログイン画面へのリダイレクトを 401 として扱う（`apps/extension/src/lib/serverClient.ts`）
- ログインは拡張機能の設定オーバーレイから行う（`/auth/launch` を開くと Access のログインを経て拡張機能に戻る）。ログアウトは `/logout` から Access のログアウトへリダイレクトする
- Zaim 連携のトークンは KV にメールアドレスをキーとして保存する

### ダッシュボードの設定

1. Zero Trust の組織（team）がなければ作成する（Free プランで 50 ユーザーまで）。ログイン方法は既定のワンタイム PIN（メール）か、GitHub などの IdP を追加する
2. Workers & Pages で `quick-zaim-server` を開き、Access タブで「Protect this Worker behind Access」を選ぶ
   - 移行中は **Previews only**、本番も新しいコードに切り替えるときに **All traffic** にする（Access を有効にしないまま新しいコードを本番に出すと全 API が 401 になる）
   - ポリシーに自分のメールアドレスを許可する
   - セッション期間を決める（切れると拡張機能が未ログイン扱いになり、再ログインが必要）

### ローカル開発

`wrangler dev` には Access がないため、`apps/server/wrangler.jsonc` の `access.dev` で認証済みユーザー（`dev@example.com`）を再現している。ログイン操作は不要。未ログイン状態を試すときは `access.dev` を一時的に外す。

## ledger（Zaim API の置き換え）

Zaim API は 2026-12-07 に提供が終わるため、支払いを自前の台帳に記録する `apps/ledger` を [Void](https://void.cloud/) で作っている（現在はスパイク）。Cloudflare Workers 上の D1 と Drizzle を使い、`quick-zaim-server` とは別の Worker `quick-ledger` にデプロイする。

- URL: `https://quick-ledger.<subdomain>.workers.dev`
- API は `routes/`、Web 画面は `pages/`、スキーマは `db/schema.ts`（`void db generate` でマイグレーションを作る）
- 拡張機能からは `ledger/client` の `createLedgerClient` で型付きで呼ぶ。Void の `void/client` の fetch は `credentials` を指定できず Access の Cookie を送れないため使わない
- 拡張機能向けの型は `pnpm -F ledger run build:types` で `dist/types` に出す（`vp pack` だと Void が生成する型を読めず `any` になる）

### デプロイ

```bash
pnpm -F ledger exec void deploy
```

- 初回はチェックアウトごとに `pnpm -F ledger exec void connect --platform cloudflare` でデプロイ先を選ぶ（選択は `.void/` に保存され Git には入らない）
- デプロイ時に D1 のマイグレーションが適用される。適用前の復元ポイントと `void db restore` のコマンドが表示される
- Void は Workers Previews に対応していないため、ブランチごとの Preview はない

### 認証

- Access アプリケーションは Worker 単位（destination の type が `worker`）で作り、ポリシーは `quick-zaim-server` と共有している
- Void のアプリは静的アセットを持つため、Access のルーターが `ctx.access` を Worker に渡さない。本番では常に `Cf-Access-Jwt-Assertion` の JWT 検証で認証するので、`ACCESS_AUD` シークレットが必須（未設定だと全リクエストが 401 になる）

```bash
pnpm -F ledger exec void secret put ACCESS_AUD
```

- ローカル開発では `void.config.ts` の `cloudflare.access.dev` で認証済みユーザー（`dev@example.com`）を再現する
- コンテキスト変数の `user` は Void の認証機能（Better Auth）が型を予約しているため、`accessUser` を使う
