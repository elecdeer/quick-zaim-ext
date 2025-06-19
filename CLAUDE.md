# CLAUDE.md

このファイルは、このリポジトリでコードを作業する際に Claude Code (claude.ai/code) にガイダンスを提供します。

## Work Completion Guidelines

- 作業が完了したらまず pnpm check を実行してください。biome の --write オプションを使用して自動修正を行うことができます。

## リポジトリ概要

Zaim（家計簿サービス）との連携機能を持つブラウザ拡張機能と Cloudflare Workers API のモノレポプロジェクトです。WXT フレームワークを使用してブラウザ拡張機能を構築し、Cloudflare Workers で API を提供します。

## 共通コマンド

### 開発とビルド

```bash
# ブラウザ拡張機能 (packages/extention)
pnpm dev                     # Chrome開発モード
pnpm dev:firefox             # Firefox開発モード
pnpm build                   # Chrome用ビルド
pnpm build:firefox           # Firefox用ビルド
pnpm zip                     # Chrome用配布パッケージ作成
pnpm zip:firefox             # Firefox用配布パッケージ作成

# Cloudflare Workers (packages/workers)
pnpm dev                     # ローカル開発サーバー
pnpm deploy                  # Cloudflareにデプロイ
pnpm wrangler:types          # Cloudflare Workers型定義生成

# Zaim API型定義生成 (packages/zaim-api)
pnpm generate:openapi3       # TypeSpecからOpenAPI仕様生成
pnpm generate:ts-client      # TypeScript型定義生成
```

### コード品質チェック

```bash
# Biome（ルートでの全体チェック）
pnpm run check            # リント・フォーマット・インポート整理
pnpm run check:fix        # 自動修正
pnpm run check:fix:unsafe # 自動修正付き（unsafeオプション）

# TypeScript型チェック
pnpm run typecheck        # 速型チェック

# テスト
pnpm run test            # 全体テスト実行

# その他ツール
pnpm knip                    # 未使用コードチェック
```

## アーキテクチャ

### パッケージ構成

- **extention**: WXT ベースのブラウザ拡張機能（React + Tailwind CSS）
- **workers**: Cloudflare Workers API（Hono + AI SDK）
- **oauth**: OAuth 1.0a 認証ライブラリ（Zaim API 用）
- **zaim-api**: TypeSpec ベースの Zaim API 型定義

### 拡張機能アーキテクチャ

- **entrypoints/background.ts**: サービスワーカー
- **entrypoints/content.ts**: コンテンツスクリプト
- **entrypoints/extract.content.ts**: DOM 抽出用コンテンツスクリプト
- **entrypoints/popup/**: React 製ポップアップ UI
- **entrypoints/playwright/**: Playwright 由来の a11y 関連ユーティリティ

### Workers API アーキテクチャ

- **handlers/**: API エンドポイント（extraction, zaim）
- **services/agent/**: AI・抽出サービス
- **services/zaim/**: Zaim API 連携サービス
- Cloudflare KV を使用したトークン管理
- Google AI（Gemini）を使用したテキスト抽出

### API 型定義システム

TypeSpec で Zaim API の型定義を記述し、OpenAPI 3.0 仕様と TypeScript 型定義を生成。各エンドポイント（account, category, genre, money, user 等）ごとに分割管理。

## 開発時の注意点

### ツール設定

- **Biome**: リント・フォーマット・インポート整理
- **Knip**: 未使用コード検出（knip.json で各パッケージの設定を管理）
- **TypeScript**: Project References 対応の型チェック専用設定
  - `tsconfig.base.json`で共通設定を管理
  - `emitDeclarationOnly: true`で型定義ファイルのみ生成
  - 増分型チェックで高速化
- **pnpm**: パッケージマネージャー（workspace 設定済み）

### 権限とセキュリティ

拡張機能は以下の権限を使用：storage, activeTab, scripting, identity, debugger
OAuth 認証と Cloudflare KV での安全なトークン管理が実装済み
