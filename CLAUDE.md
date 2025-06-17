# CLAUDE.md

このファイルは、このリポジトリでコードを作業する際にClaude Code (claude.ai/code) にガイダンスを提供します。

## リポジトリ概要

Zaim（家計簿サービス）との連携機能を持つブラウザ拡張機能とCloudflare Workers APIのモノレポプロジェクトです。WXTフレームワークを使用してブラウザ拡張機能を構築し、Cloudflare WorkersでAPIを提供します。

## 共通コマンド

### 開発とビルド
```bash
# ルートレベル（全体）
pnpm test                    # テスト実行
pnpm knip                    # 未使用コードチェック
pnpm typecheck               # TypeScript型チェック（Project References対応）

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
npx biome check .            # リント・フォーマット・インポート整理
npx biome check . --write    # 自動修正付き

# TypeScript型チェック
pnpm typecheck               # Project References対応の高速型チェック

# 個別パッケージでの型チェック（従来方式）
cd packages/extention && pnpm check:type
cd packages/oauth && pnpm check:type
```

## アーキテクチャ

### パッケージ構成
- **extention**: WXTベースのブラウザ拡張機能（React + Tailwind CSS）
- **workers**: Cloudflare Workers API（Hono + AI SDK）
- **oauth**: OAuth 1.0a認証ライブラリ（Zaim API用）
- **zaim-api**: TypeSpecベースのZaim API型定義

### 拡張機能アーキテクチャ
- **entrypoints/background.ts**: サービスワーカー
- **entrypoints/content.ts**: コンテンツスクリプト
- **entrypoints/extract.content.ts**: DOM抽出用コンテンツスクリプト
- **entrypoints/popup/**: React製ポップアップUI
- **entrypoints/playwright/**: Playwright由来のa11y関連ユーティリティ

### Workers APIアーキテクチャ
- **handlers/**: APIエンドポイント（extraction, zaim）
- **services/agent/**: AI・抽出サービス
- **services/zaim/**: Zaim API連携サービス
- Cloudflare KVを使用したトークン管理
- Google AI（Gemini）を使用したテキスト抽出

### API型定義システム
TypeSpecでZaim APIの型定義を記述し、OpenAPI 3.0仕様とTypeScript型定義を生成。各エンドポイント（account, category, genre, money, user等）ごとに分割管理。

## 開発時の注意点

### ツール設定
- **Biome**: リント・フォーマット・インポート整理
- **Knip**: 未使用コード検出（knip.jsonで各パッケージの設定を管理）
- **TypeScript**: Project References対応の型チェック専用設定
  - `tsconfig.base.json`で共通設定を管理
  - `emitDeclarationOnly: true`で型定義ファイルのみ生成
  - 増分型チェックで高速化
- **pnpm**: パッケージマネージャー（workspace設定済み）

### 権限とセキュリティ
拡張機能は以下の権限を使用：storage, activeTab, scripting, identity, debugger
OAuth認証とCloudflare KVでの安全なトークン管理が実装済み