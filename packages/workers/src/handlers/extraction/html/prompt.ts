import type { Shop } from "./ai";

export const prompt = ({
	html,
	shops,
}: {
	html: string;
	shops: Shop[];
}) => `
Contentは請求書や領収書を表示するHTMLを元にして生成されたAccessibility Treeです。
Contentより注文の情報を読み取り出力してください。

Shopsは商品を購入した場所のリストです。JSON形式です。
descriptionには、その店舗に関する説明が記述されていることがあります。
店舗が一致する場合、その店舗のdescriptionを以降の推論で考慮してください。
一致しない店舗のdescriptionは無視する必要がしなければなりません。
出力のshopIdにShopsに記載されているIdを設定する必要があります。

## 注意点

割引についても商品の一つとして扱わなければなりません。価格はマイナスになります。

normalizedNameは商品名からノイズを取り除いたものです。
50文字以下になることが望ましいです。
宣伝文句や重複しているキーワードなどがノイズとして扱われます。
メーカーやブランド名、個数や支払い種別に関する情報はノイズではありません。

<Content>
${html}
</Content>

<Shops>
${JSON.stringify(shops)}
</Shops>
`;

// TODO: カテゴリ
// TODo: 出金元
