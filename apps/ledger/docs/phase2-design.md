# フェーズ2 設計: 拡張機能向けの API と拡張機能の切り替え

## 目的

拡張機能のサーバー URL を `tsuke` に向けたとき、今の機能（登録・重複チェック・自動入力・ログイン）がすべて台帳で動くようにする。`apps/server`（`quick-zaim-server`）はフェーズ4で撤去するまで残すが、拡張機能からは呼ばなくなる。

## 今の拡張機能が呼んでいる API

| 用途                        | 今（apps/server）                                                             | 呼び出し元                                                                                                                       |
| --------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| ログイン状態                | `GET /me`                                                                     | [authQueries.ts](../../extension/src/entrypoints/sidepanel/authQueries.ts)                                                       |
| ログイン起動                | `GET /auth/launch`                                                            | [serverAuth.ts](../../extension/src/auth/serverAuth.ts)                                                                          |
| ログアウト                  | `GET /logout`                                                                 | [SettingsOverlay.tsx](../../extension/src/components/SettingsOverlay.tsx)                                                        |
| Zaim 連携の状態・開始・解除 | `GET /zaim/auth/status` ほか                                                  | authQueries.ts, [zaimAuth.ts](../../extension/src/auth/zaimAuth.ts), SettingsOverlay.tsx                                         |
| 口座・カテゴリ・店舗        | `GET /api/zaim/{accounts,categories,stores}`                                  | [queries.ts](../../extension/src/queries.ts), [MainScreen.tsx](../../extension/src/entrypoints/sidepanel/screens/MainScreen.tsx) |
| 自動入力                    | `POST /api/llm/extract-payment`（口座・カテゴリ・店舗の一覧を拡張機能が送る） | MainScreen.tsx                                                                                                                   |
| 重複チェック                | `GET /api/zaim/payment/duplicate`（品目ごとに 1 回）                          | MainScreen.tsx                                                                                                                   |
| 登録                        | `POST /api/zaim/payment`（品目ごとに 1 回）                                   | MainScreen.tsx                                                                                                                   |

## 台帳の API

すべて Cloudflare Access の後ろにあり、`middleware/02.access.ts` が認証する。入力は valibot のスキーマで `defineHandler.withValidator` を使って検証し、失敗すると Void が 400 と検証エラーを返す。

### 認証

| メソッドとパス                   | 内容                                                          |
| -------------------------------- | ------------------------------------------------------------- |
| `GET /me`                        | `{ email, id }`（実装済み）                                   |
| `GET /auth/launch?redirect_uri=` | 拡張機能へリダイレクト（実装済み）                            |
| `GET /logout`                    | Access のログアウト（`/cdn-cgi/access/logout`）へリダイレクト |

### マスタ

アーカイブしたものは返さない。並びは `sort`、`id` の順。

```ts
// GET /api/accounts
{
  accounts: {
    id: number;
    name: string;
  }
  [];
}

// GET /api/categories?mode=payment
{
  categories: {
    id: number;
    name: string;
    genres: {
      id: number;
      name: string;
    }
    [];
  }
  [];
}

// GET /api/places
// 最後に使った日の新しい順。使ったことのない店舗は後ろに名前順で並ぶ
{
  places: {
    id: number;
    name: string;
    lastUsedOn: string | null;
    useCount: number;
  }
  [];
}
```

- Zaim 由来の `active`（アーカイブで代わる）、`placeUid`、キャッシュ用の `fetchedAt` はなくす
- 「サブカテゴリ」は台帳の用語に合わせて `genres` と呼ぶ。拡張機能の画面の表示は変えない

### 取引

```ts
// POST /api/transactions（支出の登録）
// body
{
  date: string; // YYYY-MM-DD
  fromAccountId: number | null;
  placeName: string | null; // 完全に一致する店舗がなければ作る
  items: {
    // 1 件以上
    genreId: number; // カテゴリは内訳の親から決める
    name: string | null;
    memo: string | null;
    amount: number; // 整数。値引きは負
  }
  [];
}
// response
{
  id: number;
}
```

- 取引・品目・店舗の作成を `db.batch` で 1 回のトランザクションにする。今は品目ごとに POST していて、途中で失敗すると一部の品目だけが登録されていた
- 種類は支出だけ受け付ける。収入・振替の入力は拡張機能にないので、Web 画面（フェーズ3）で必要になったら足す
- `source` は `manual`、集計の設定は `always` で作る

```ts
// POST /api/transactions/duplicates（重複チェック。DB は変えない）
// body
{ date: string; items: { genreId: number; amount: number }[] }
// response: items と同じ順で、品目ごとの重複候補
{ duplicates: { transactionId: number; date: string; amount: number; placeName: string | null }[][] }
```

- 判定は今と同じく「日付が ±1 日、金額と内訳が一致」。CSV から取り込んだ取引も対象にする
- 品目ごとに呼んでいたのを 1 回にまとめる。品目のリストを送るので GET のクエリではなく POST にする

### 自動入力

```ts
// POST /api/transactions/extract
// body
{
  pageContent: {
    url: string;
    title: string;
    ariaSnapshot: string;
    collectedAt: string;
  }
}
// response
{
  date: string | null;
  accountId: number | null;
  placeName: string | null;
  items: {
    name: string | null;
    amount: number | null;
    memo: string | null;
    genreId: number | null;
  }
  [];
  confidence: "high" | "medium" | "low";
  reasoning: string;
}
```

- `apps/server/src/features/llm` のプロンプトと Workers AI の呼び出しを `src/llm/` に移す
- **口座・カテゴリ・店舗の一覧は台帳が D1 から読む。** 今は拡張機能が 3 つの一覧を取得してから送っているが、台帳は自分で読めるので、拡張機能はページの内容だけを送ればよい。往復が 1 回減り、送るデータも小さくなる
- モデルは `env.ts` の `LLM_MODEL`（既定値は今と同じ `openai/gpt-5.4-mini`）。Workers AI のバインディングは Void が `c.env.AI` の参照から作る
- 品目の `comment` は台帳の用語に合わせて `memo`、`place` は `placeName` にする
- 評価スクリプト（`apps/server/scripts/eval-extract-payment.ts`）はフェーズ4で移す

### 明細からの一括登録

main で拡張機能に「明細から一括」のタブ（カード明細から利用行を読み取り、概要だけでまとめて登録する）が入ったので、これも台帳で動かす。

```ts
// POST /api/statements/extract
// body: 自動入力と同じ { pageContent }
// response
{
  accountId: number | null;
  rows: {
    date: string | null;
    place: string | null; // 明細に書かれた利用先名
    placeName: string | null; // 同じ店と推測した既存の店舗の名前
    amount: number | null;
    genreId: number | null;
  }[];
  confidence: "high" | "medium" | "low";
  reasoning: string;
}

// POST /api/statements/registered（登録済みの判定。DB は変えない）
// body
{ entries: { date: string; amount: number }[] } // 500 行まで
// response: entries と同じ順で、割り当てた支出（なければ null）
{ matches: ({ transactionId: number; date: string; amount: number; placeName: string | null } | null)[] }
```

- 明細の読み取りは自動入力と同じく、口座・カテゴリ・店舗を台帳が読む。明細の利用先名は半角カナや略称で店舗名とずれるので、既存の店舗への照合は LLM に任せる（候補は最近使った 200 件）
- 登録済みの判定は Zaim のときと同じく「金額が一致し、日付のずれが ±2 日以内」で、ずれの小さい組から 1 対 1 で割り当てる。金額は取引の品目の合計と比べる（レシートを品目ごとに登録した取引も、合計が明細の金額と一致する）
- 登録は行ごとに `POST /api/transactions` を呼ぶ。行ごとに 1 件の取引で、途中で失敗したときにどの行まで登録できたかを画面に出せる
- 店舗に紐付かない行は、Zaim のときと同じく利用先名を品名に入れ、店舗は空にする。明細の表記のまま店舗を作ると、表記ゆれの店舗が増えるため

### レスポンスの型と状態コード

- 拡張機能は `ledger/client` の `createLedgerClient` で呼び、レスポンスの型はハンドラの戻り値から生成したものを使う。拡張機能の [queries.ts](../../extension/src/queries.ts) にある手書きの型はなくす
- 作成も 200 で返す。Void ではハンドラが値を返すと、`c.status(201)` を指定しても 200 になり、`c.json(x, 201)` にするとレスポンスの型が推論されなくなるため
- エラーは `{ error: string }`。2xx 以外は `LedgerFetchError` になる

## 拡張機能の変更

- `server/client`（Hono の RPC クライアント）を `ledger/client` に置き換える。Access のセッション Cookie とログイン画面へのリダイレクトの扱い（`accessAwareFetch`）はそのまま使う
- Zaim 連携の UI（`ZaimLogin`、`zaimAuth.ts`、設定画面の連携・解除、`/zaim/auth/status` の呼び出し）を消す。台帳には Zaim がないので、ログインだけでメイン画面に進める
- 店舗の選択は `{ place, placeUid }` から店舗名に変える
- 登録は品目ごとの POST をやめて 1 回にする。重複チェックも 1 回にする
- 自動入力は、マスタの一覧の取得をやめてページの内容だけを送る。返ってきた `genreId` から親カテゴリを引く処理（`findCategorySelectionByGenreId`）は残す
- Storybook とテストの MSW のモックを新しい API に合わせる

## 切り替えの手順

1. 台帳に API を実装してデプロイする
2. 拡張機能を台帳の API に合わせて直す。この時点で拡張機能は `quick-zaim-server` では動かなくなる
3. 切り替える日に Zaim から最新の CSV を出し、本番の D1 を総入れ替えする（[phase1-design.md](./phase1-design.md)）
4. 拡張機能の設定でサーバー URL を `tsuke` に変える
5. 以降の記録は台帳だけに入れる

2 と 4 の間は拡張機能が使えないので、2 の拡張機能のビルドを読み込むのは切り替える日にする。

## 決めたこと

- **TASKS.md の Ph2「ミスリカバリー」（直近の登録の一覧・更新・削除）はフェーズ2に含めない。** 切り替えを先に済ませ、その後で別に進める
- **自動入力のリクエストからマスタの一覧をなくす。** 口座・カテゴリ・店舗は台帳が D1 から読む
