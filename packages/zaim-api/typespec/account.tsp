import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi3";

using TypeSpec.Http;

@route("/home/account")
namespace ZaimAPI.Account {
  model Account {
    /** Unique account ID */
    id: int32;

    /** Account name */
    name: string;

    /** Last modified timestamp */
    modified: string;

    /** Sort order */
    sort: int32;

    /** Active status */
    active: int32;

    /** Local account ID */
    local_id: int32;

    /** Website ID */
    website_id: int32;

    /** Parent account ID */
    parent_account_id: int32;
  }

  @route("/")
  @get
  op getAccounts(
    /** Required. Set to 1 */
    @query mapping: 1,
  ): SuccessResponse<{
    /** List of accounts */
    accounts: Account[];
  }> | ErrorResponse;
}
