import { describe, expect, test } from "vite-plus/test";
import { actionErrorMessage } from "./actionError.ts";

describe("actionErrorMessage", () => {
  test("本文の error を使う", () => {
    expect(
      actionErrorMessage({ body: { error: "口座が見つかりません" }, message: "Bad Request" }),
    ).toBe("口座が見つかりません");
  });

  test("本文に error がなければ message を使う", () => {
    expect(actionErrorMessage({ body: { issues: [] }, message: "Bad Request" })).toBe(
      "Bad Request",
    );
  });

  test("message も空なら決まった文言にする", () => {
    expect(actionErrorMessage({ body: null, message: "" })).toBe("保存できませんでした");
  });
});
