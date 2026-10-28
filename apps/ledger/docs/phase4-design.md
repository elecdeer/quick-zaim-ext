# フェーズ4 設計: Zaim 関連の撤去とデータの削除

## 目的

Zaim API は 2026-12-07 に提供を終え、API で取得したデータとトークンは 2027-01-07 までに削除する義務がある。台帳への移行が済んだので、Zaim API を使うコード・動いている Worker・保存したデータを消す。

作業は 2 つに分ける。

1. **リポジトリから消す**（このフェーズで先にやる）。動いている `quick-zaim-server` には触れないので、切り替え前の拡張機能もそのまま動く
2. **Cloudflare と Zaim の側で消す**（切り替えの後にやる）。下の「切り替えの後の手順」に沿って行う

## リポジトリから消すもの

| 対象                                 | 内容                                                                                                                                                                                   |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/server`                        | `quick-zaim-server`（Hono）。Zaim の OAuth、Zaim API の中継、自動入力                                                                                                                  |
| `packages/zaim-api`                  | TypeSpec から生成する Zaim API のクライアント                                                                                                                                          |
| ルートの `package.json`              | `dev`・`build:server`・`version:upload`・`deploy:preview` の server 向けの指定                                                                                                         |
| `pnpm-workspace.yaml` のカタログ     | server と zaim-api だけが使う依存（`@typespec/*`、`@hey-api/openapi-ts`、`@logtape/*`、`@hono/standard-validator`、`@tanstack/react-query`、`wrangler`）。使われなくなったものだけ消す |
| `vite.config.ts`・`vitest.config.ts` | server と zaim-api の lint の設定、テストのプロジェクト                                                                                                                                |
| `.github/workflows/ci.yml`           | `@repo/zaim-api#generate` の手順                                                                                                                                                       |
| `docker/vrt.Dockerfile`              | server と zaim-api の `package.json` のコピー                                                                                                                                          |
| `.gitignore`                         | server と zaim-api の生成物・評価結果の行                                                                                                                                              |
| `CLAUDE.md`                          | 「Server (Hono) Coding Conventions」の節（apps/server のための決まり）                                                                                                                 |
| `README.md`                          | server の Preview・デプロイ・初回セットアップ、Zaim 連携の説明                                                                                                                         |
| 台帳のコメント・設計書               | `quick-zaim-server` と並べて動かす前提の書き方を、撤去後に合わせて直す                                                                                                                 |

## 評価スクリプトを台帳に移す

`apps/server/scripts/eval-extract-payment.ts`（自動入力の抽出を複数のモデルで流し、項目ごとの一致率・時間・トークン数を比べる）と事例（`eval-fixtures/amazon.json`）を `apps/ledger/scripts/` に移す。

- 抽出は台帳の `runExtractPayment`（`src/llm/extractPayment.ts`）を呼ぶ。プロンプトと出力の形は台帳のものになる
- 事例の入力は台帳の `ExtractPaymentContext` の形（ページの内容と、口座・カテゴリ・店舗の候補）にする。今の事例は Zaim のカテゴリ ID を使っているので、事例の中だけで使う台帳の ID に書き換える。期待する値も同じ ID に合わせる
- Workers AI は wrangler の `getPlatformProxy` ではなく、Cloudflare の AI の REST API（`/accounts/{account_id}/ai/run`）で呼ぶ。台帳には wrangler の設定がなく、Void の開発サーバーのリモート接続は Access のサービストークンが要るため。`AiRunner`（`src/llm/structuredChat.ts`）と同じ形の関数を REST API で作って渡す。認証は `CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID`
- `package.json` に `eval:extract-payment` のスクリプトを置く。結果の出力先（`scripts/eval-results/`）は Git に入れない

## 切り替えの後の手順

拡張機能を台帳に切り替えた後（[phase2-design.md](./phase2-design.md) の「切り替えの手順」）に行う。2027-01-07 までに済ませる。

| 順  | 対象                                                             | やること                                                                                                                                             |
| --- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 拡張機能                                                         | サーバー URL が `quick-ledger` になっていて、登録できることを確かめる                                                                                |
| 2   | Zaim Developers のアプリ（本番用と Preview 用）                  | Zaim の画面で削除する。発行したアクセストークンも使えなくなる（Zaim のアカウントでの操作なので本人が行う）                                           |
| 3   | Worker `quick-zaim-server`                                       | `cf` で削除する。シークレット（`ZAIM_CONSUMER_KEY`・`ZAIM_CONSUMER_SECRET` など）、版、ブランチごとの Preview（`zaim-connect` を含む）も一緒に消える |
| 4   | KV `ZAIM_KV`（本番 `c1d27951…` と Preview 用 `5ab64072…`）       | `cf` で削除する。Zaim のアクセストークン、OAuth の途中の状態、口座・カテゴリ・店舗・入出金の取得結果のキャッシュが入っている                         |
| 5   | Access のアプリケーション（`quick-zaim-server` 用と Preview 用） | 削除する。ポリシーは `quick-ledger` と共有しているので、アプリケーションだけを消してポリシーは残す                                                   |
| 6   | 手元の作業ディレクトリ                                           | 各チェックアウトに残っている `apps/server/.dev.vars`（Consumer Key など）と `apps/server/.wrangler/`（ローカルの KV）を消す                          |

- 消す前に、各コマンドの `--dry-run` で対象の名前と ID を確かめ、消した後に一覧で残っていないことを確かめる
- Workers Logs には Zaim API の応答の本文（先頭の一部）が残っている。Workers Logs は保持期間（3 日。Workers Paid では 7 日）を過ぎると消えるので、手で消す操作はない。最後に Zaim API を呼んでから保持期間が過ぎたことを確かめる
- 本番 D1 のデータは Zaim の CSV（ファイル入出力）から取り込んだもので、API で取得したものではないので、削除の対象ではない

## 決めたこと

- **リポジトリから先に消し、動いている Worker などは切り替えの後に消す。** 切り替えは Zaim から最新の CSV を出す日にまとめて行うので、それまでは拡張機能が `quick-zaim-server` を使い続ける。リポジトリから消しても、デプロイ済みの Worker はそのまま動く
- **評価スクリプトは台帳に移す。** プロンプトを変えるときに、モデルごとの精度と時間を比べられるようにしておくため

## 範囲外

- 拡張機能の名前（「Quick Zaim」）やリポジトリ名の変更
- TASKS.md の整理（Zaim API を前提にした未着手のタスクの書き直し）
