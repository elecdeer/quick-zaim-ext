export const prompt = (html: string) => `
Contentは請求書や領収書を表示するHTMLです。
Contentより注文の情報を読み取り、resultを呼び出す形で出力してください。

## 関数

### searchShop

購入した店舗やサイトの検索を行います。
searchShopを用いてContentの店舗やサイトを検索し、resultに渡さなければなりません。

### result

Contentより注文の情報を読み取った結果を出力します。
必ず1度だけ呼び出さなければなりません。

## 注意点

割引についても商品の一つとして扱わなければなりません。価格はマイナスになります。

normalizedNameは商品名からノイズを取り除いたものです。
50文字以下になることが望ましいです。
宣伝文句や重複しているキーワードなどがノイズとして扱われます。
メーカーやブランド名はノイズではありません。

<Content>
${html}
</Content>
`;
