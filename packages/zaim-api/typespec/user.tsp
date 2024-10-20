import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi3";

using TypeSpec.Http;

@route("/home/user")
namespace ZaimAPI.User {
  model User {
    /** Unique user ID */
    id: int32;

    /** Unique string for user login */
    login: string;

    /** User name */
    name: string;

    /** Total number of inputs */
    input_count: int32;

    /** Total number of days */
    day_count: int32;

    /** Days of continuous recording */
    repeat_count: int32;

    /** Start date of the month */
    day: int32;

    /** First day of the week */
    week: int32;

    /** Start date of the year */
    month: int32;

    /** Default currency code */
    currency_code: string;

    /** URL of the user's profile image */
    profile_image_url: url;

    /** URL of the user's cover image */
    cover_image_url: url;

    /** Last modified time of the user's profile */
    profile_modified: string;
  }

  @route("/verify")
  @get
  op verifyUser(): SuccessResponse<{
    /** User information */
    me: User;
  }> | ErrorResponse;
}
