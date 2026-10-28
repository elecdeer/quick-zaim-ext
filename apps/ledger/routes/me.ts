import { defineHandler } from "void";

/**
 * ログイン中のユーザー。拡張機能の設定画面がログイン状態の確認に使う。
 */
export const GET = defineHandler((c) => {
  const user = c.get("accessUser");
  return { email: user.email, id: user.id };
});
