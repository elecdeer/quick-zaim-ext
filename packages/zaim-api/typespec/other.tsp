import "@typespec/http";
import "@typespec/openapi3";

using TypeSpec.Http;

@route("/")
namespace ZaimAPI.Other {
  model DefaultAccount {
    /** Unique account ID */
    id: int32;

    /** Account name */
    name: string;
  }

  @route("/account")
  @get
  op getDefaultAccounts(): SuccessResponse<{
    /** List of default accounts */
    accounts: DefaultAccount[];
  }> | ErrorResponse;

  model DefaultCategory {
    /** Unique category ID */
    id: int32;

    /** Type of category: "payment" or "income" */
    mode: "payment" | "income";

    /** Category name */
    name: string;
  }

  @route("/category")
  @get
  op getDefaultCategories(): SuccessResponse<{
    /** List of default categories */
    categories: DefaultCategory[];
  }> | ErrorResponse;

  model DefaultGenre {
    /** Unique genre ID */
    id: int32;

    /** Category ID this genre belongs to */
    category_id: int32;

    /** Genre name */
    name: string;
  }

  @route("/genre")
  @get
  op getDefaultGenres(): SuccessResponse<{
    /** List of default genres */
    genres: DefaultGenre[];
  }> | ErrorResponse;

  model Currency {
    /** Currency code */
    currency_code: string;

    /** Currency unit symbol */
    unit: string;

    /** Currency name */
    name: string;

    /** Number of decimal points */
    point: int32;
  }

  @route("/currency")
  @get
  op getCurrencies(): SuccessResponse<{
    /** List of currencies */
    currencies: Currency[];
  }> | ErrorResponse;
}
