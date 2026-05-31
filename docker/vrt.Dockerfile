FROM mcr.microsoft.com/playwright:v1.60.0-jammy

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.1.1 --activate

# lockfileのみでパッケージをvirtual storeにダウンロード
# lockfileが変わらない限りこのレイヤーはキャッシュされる
COPY pnpm-lock.yaml ./
RUN pnpm fetch

# package.jsonをコピーしてオフラインインストール
# CI=true: prepare スクリプト内のlefthookとwxt prepareをスキップする
COPY package.json pnpm-workspace.yaml ./
COPY apps/extension/package.json apps/extension/
COPY apps/server/package.json apps/server/
COPY packages/zaim-api/package.json packages/zaim-api/

RUN CI=true pnpm install --offline --frozen-lockfile

# ソースファイルをコピーしてwxt prepareを実行
COPY . .

RUN cd apps/extension && pnpm exec wxt prepare

WORKDIR /app/apps/extension

CMD ["pnpm", "run", "test:visual"]
