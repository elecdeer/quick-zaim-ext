import "@typespec/http";
import "@typespec/openapi3";

using TypeSpec.Http;

/**
 * Zaim OAuth 1.0a 認証エンドポイント
 *
 * 注意: これらのエンドポイントはリクエスト・レスポンスともに
 * application/x-www-form-urlencoded 形式であり、標準の JSON API とは異なる。
 * エラーレスポンスもプレーンテキストで返される。
 */
@route("/auth")
namespace ZaimAPI.Auth {
  /** Request Token (/v2/auth/request) の正常レスポンスモデル */
  model RequestTokenResponse {
    oauth_token: string;
    oauth_token_secret: string;
    oauth_callback_confirmed: boolean;
  }

  /** Access Token (/v2/auth/access) の正常レスポンスモデル */
  model AccessTokenResponse {
    oauth_token: string;
    oauth_token_secret: string;
  }

  /**
   * OAuth 1.0a Request Token の取得
   *
   * Authorization ヘッダーに OAuth 1.0a 署名を含めて POST する。
   */
  @route("/request")
  @post
  op requestToken(): {
    @statusCode statusCode: 200;
    @body body: string;
  } | {
    @statusCode statusCode: 400 | 401;
    @body body: string;
  };

  /**
   * OAuth 1.0a Access Token の取得
   *
   * Authorization ヘッダーに OAuth 1.0a 署名 + oauth_verifier を含めて POST する。
   */
  @route("/access")
  @post
  op accessToken(): {
    @statusCode statusCode: 200;
    @body body: string;
  } | {
    @statusCode statusCode: 400 | 401;
    @body body: string;
  };
}
