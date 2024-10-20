import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi3";

using TypeSpec.Http;

@route("/home/category")
namespace ZaimAPI.Category {
  model Category {
    /** Unique category ID */
    id: int32;

    /** Category name */
    name: string;

    /** Type of category: "payment" or "income" */
    mode: "payment" | "income";

    /** Sort order */
    sort: int32;

    /** Parent category ID */
    parent_category_id: int32;

    /** Active status */
    active: int32;

    /** Last modified timestamp */
    modified: string;

    /** (Undocumented) */
    local_id: int32;
  }

  @route("")
  @get
  op getCategories(
    /** Required. Set to 1 */
    @query mapping: 1,
  ): SuccessResponse<{
    /** List of categories */
    categories: Category[];
  }> | ErrorResponse;
}
