import "@typespec/http";
import "@typespec/openapi3";

using TypeSpec.Http;

@route("/home/genre")
namespace ZaimAPI.Genre {
  model Genre {
    /** Unique genre ID */
    id: int32;

    /** Genre name */
    name: string;

    /** Sort order */
    sort: int32;

    /** Active status */
    active: int32;

    /** Category ID this genre belongs to */
    category_id: int32;

    /** Parent genre ID */
    parent_genre_id: int32;

    /** Last modified timestamp */
    modified: string;

    /** (Undocumented) */
    local_id: int32;
  }

  @route("")
  @get
  op getGenres(
    /** Required. Set to 1 */
    @query mapping: 1,
  ): SuccessResponse<{
    /** List of genres */
    genres: Genre[];
  }> | ErrorResponse;
}
