import { describe, expect, test } from "vite-plus/test";
import { placeOptions } from "./placeOptions.ts";

describe("placeOptions", () => {
  test("入力が空なら過去の店舗だけを候補にする", () => {
    expect(placeOptions(["スーパーA", "カフェC"], "")).toEqual([
      { name: "スーパーA", isNew: false },
      { name: "カフェC", isNew: false },
    ]);
  });

  test("一覧にない名前を入れると、その名前を追加する候補を末尾に足す", () => {
    expect(placeOptions(["スーパーA"], "はじめての店")).toEqual([
      { name: "スーパーA", isNew: false },
      { name: "はじめての店", isNew: true },
    ]);
  });

  test("一覧と同じ名前なら追加の候補を出さない", () => {
    expect(placeOptions(["スーパーA"], "スーパーA")).toEqual([{ name: "スーパーA", isNew: false }]);
  });

  test("前後の空白は落として扱う", () => {
    expect(placeOptions(["スーパーA"], "  スーパーA ")).toEqual([
      { name: "スーパーA", isNew: false },
    ]);
    expect(placeOptions([], "  新しい店 ")).toEqual([{ name: "新しい店", isNew: true }]);
    expect(placeOptions([], "   ")).toEqual([]);
  });
});
