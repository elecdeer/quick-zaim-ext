/**
 * buildPrompt / buildStatementPrompt のフォーマット回帰テスト。
 *
 * LLM の品質はモデル次第なので動作確認はできないが、プロンプト中に渡している
 * カテゴリ/口座/店舗の表現が崩れていないことを確認する。
 */

import { describe, expect, test } from "vite-plus/test";
import { buildPrompt, buildStatementPrompt } from "./service.ts";
import type { ExtractPaymentBody } from "./schema.ts";

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

describe("buildStatementPrompt", () => {
  test("カテゴリ・口座・店舗の候補を支払い抽出と同じ形式で渡す", () => {
    const { prompt } = buildStatementPrompt(baseInput());
    expect(prompt).toContain("101=食費: 10101=食料品, 10102=カフェ");
    expect(prompt).toContain("1=現金, 2=Suica");
    expect(prompt).toContain("スーパーA [uid=uid_a, 5x, 2026-05-30]");
  });

  test("支払い抽出より長い ARIA snapshot をそのまま渡す", () => {
    const longSnapshot = "row: 2026/05/01 店 1,000\n".repeat(1000);
    const { prompt } = buildStatementPrompt(
      baseInput({
        pageContent: {
          url: "https://example.com/statement",
          title: "ご利用明細",
          ariaSnapshot: longSnapshot,
          collectedAt: "2026-06-01T00:00:00Z",
        },
      }),
    );
    expect(longSnapshot.length).toBeGreaterThan(16000);
    expect(prompt).toContain(longSnapshot);
    expect(prompt).not.toContain("truncated");
  });

  test("店舗は支払い抽出の上限（20 件）を超えて候補に渡す", () => {
    const recentStores = Array.from({ length: 30 }, (_, i) => ({
      place: `店${i}`,
      placeUid: `uid_${i}`,
      latestDate: "2026-05-01",
      count: 1,
    }));
    const { prompt } = buildStatementPrompt(baseInput({ recentStores }));
    expect(prompt).toContain("店29 [uid=uid_29, 1x, 2026-05-01]");
    expect(buildPrompt(baseInput({ recentStores })).prompt).not.toContain("店29");
  });

  test("system プロンプトで既存店舗の uid を選ばせる", () => {
    const { system } = buildStatementPrompt(baseInput());
    expect(system).toContain("`placeUid`");
    expect(system).toContain("never invent a uid");
  });

  test("system プロンプトに明細抽出のルールが入っている", () => {
    const { system } = buildStatementPrompt(baseInput());
    expect(system).toContain("monthly statement");
    expect(system).toContain("usage/transaction date");
    expect(system).toContain("Skip refunds");
  });
});
