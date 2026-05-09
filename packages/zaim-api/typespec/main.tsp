import "@typespec/http";
import "@typespec/openapi3";
import "./user.tsp";
import "./money.tsp";
import "./category.tsp";
import "./genre.tsp";
import "./account.tsp";
import "./other.tsp";
import "./auth.tsp";

using TypeSpec.Http;

@service(#{
  title: "Zaim API",
})
@route("/v2")
namespace ZaimAPI;

model SuccessResponse<T> {
  @statusCode statusCode: 200;
  ...T;
  requested: unixTimestamp32;
}

model ErrorResponse {
  @statusCode statusCode: 400 | 401;
  error: true;
  message: string;
}
