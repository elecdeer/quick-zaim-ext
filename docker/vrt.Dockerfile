FROM mcr.microsoft.com/playwright:v1.60.0-jammy

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@12.14.0 --activate

# lockfileのみでパッケージをvirtual storeにダウンロード
# lockfileとworkspace設定が変わらない限りこのレイヤーはキャッシュされる
# pnpm 12 は fetch 時にカタログ定義を lockfile と照合するため pnpm-workspace.yaml も必要
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch

# package.jsonをコピーしてオフラインインストール
# CI=true: prepare スクリプト内のlefthookとwxt prepareをスキップする
COPY package.json ./
COPY apps/extension/package.json apps/extension/
COPY apps/ledger/package.json apps/ledger/

RUN CI=true pnpm install --offline --frozen-lockfile

# ソースファイルをコピーしてwxt prepareを実行
COPY . .

RUN cd apps/extension && CI=true pnpm exec wxt prepare

WORKDIR /app/apps/extension

CMD ["pnpm", "run", "test:browser"]
