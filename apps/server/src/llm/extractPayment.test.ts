/**
 * buildPrompt のフォーマット回帰テスト。
 *
 * LLM の品質はモデル次第なので動作確認はできないが、プロンプト中に渡している
 * カテゴリ/口座/店舗の表現が崩れていないこと（= ID と名称が揃って出ていること、
 * 余計なトークンが増えていないこと）を以下で確認する。
 */

import { describe, expect, test } from "vitest";
import { buildPrompt, type ExtractPaymentBody } from "./extractPayment.ts";

const baseInput = (overrides: Partial<ExtractPaymentBody> = {}): ExtractPaymentBody => ({
  pageContent: {
    url: "https://example.com/order/1",
    title: "Order",
    ariaSnapshot: "heading: Order\ntext: total 1000",
    collectedAt: "2026-06-01T00:00:00Z",
  },
  categories: [
    {
      id: 101,
      name: "食費",
      mode: "payment",
      subCategories: [
        { id: 10101, name: "食料品" },
        { id: 10102, name: "カフェ" },
      ],
    },
    {
      id: 11,
      name: "給与所得",
      mode: "income",
      subCategories: [],
    },
  ],
  accounts: [
    { id: 1, name: "現金" },
    { id: 2, name: "Suica" },
  ],
  recentStores: [
    { place: "スーパーA", placeUid: "uid_a", latestDate: "2026-05-30", count: 5 },
    { place: "コンビニB", placeUid: "uid_b", latestDate: "2026-05-29", count: 3 },
  ],
  ...overrides,
});

describe("buildPrompt", () => {
  test("カテゴリは payment のみを 1 行 1 カテゴリで列挙する", () => {
    const { prompt } = buildPrompt(baseInput());
    expect(prompt).toContain("101=食費: 10101=食料品, 10102=カフェ");
    // income カテゴリ（給与所得）は含めない
    expect(prompt).not.toContain("給与所得");
    expect(prompt).not.toContain("11=");
  });

  test("口座は ID=name のカンマ区切り", () => {
    const { prompt } = buildPrompt(baseInput());
    expect(prompt).toContain("1=現金, 2=Suica");
  });

  test("店舗は uid・使用回数・最終日とともに 1 行ずつ", () => {
    const { prompt } = buildPrompt(baseInput());
    expect(prompt).toContain("スーパーA [uid=uid_a, 5x, 2026-05-30]");
    expect(prompt).toContain("コンビニB [uid=uid_b, 3x, 2026-05-29]");
  });

  test("店舗が無いときは (none) を出す", () => {
    const { prompt } = buildPrompt(baseInput({ recentStores: [] }));
    expect(prompt).toContain("## Recent stores");
    expect(prompt).toContain("(none)");
  });

  test("ARIA snapshot が ariaSnapshot ブロックに含まれる", () => {
    const { prompt } = buildPrompt(baseInput());
    expect(prompt).toContain("heading: Order\ntext: total 1000");
  });

  test("URL/Title/Collected at がプロンプト先頭に並ぶ", () => {
    const { prompt } = buildPrompt(baseInput());
    expect(prompt.startsWith("URL: https://example.com/order/1\nTitle: Order\nCollected at:")).toBe(
      true,
    );
  });

  test("system プロンプトに主要ルールが入っている", () => {
    const { system } = buildPrompt(baseInput());
    expect(system).toContain("Extract payment info");
    expect(system).toContain("YYYY-MM-DD");
    expect(system).toContain("`items` is never empty");
  });
});
