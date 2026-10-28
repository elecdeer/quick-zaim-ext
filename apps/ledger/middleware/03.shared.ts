import { defineMiddleware } from "void";

declare module "void" {
  interface CloudContextVariables {
    /** 画面のレイアウトに渡すデータ（`useShared()` で読む） */
    shared: { email: string };
  }
}

/**
 * ログイン中のメールアドレスを画面のレイアウトに渡す。
 *
 * Void のデプロイ時の準備確認（/__void/*）は 02.access.ts がユーザーを設定せずに通すので、何もしない。
 */
export default defineMiddleware(async (c, next) => {
  if (!c.req.path.startsWith("/__void/")) {
    c.set("shared", { email: c.get("accessUser").email });
  }
  await next();
});
