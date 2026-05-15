import ts from "typescript";
import { $ } from "@hey-api/openapi-ts";

import type { MyMswPlugin } from "./types";
import { toCamelCase, toMswPath } from "./utils";

export const handler: MyMswPlugin["Handler"] = ({ plugin }) => {
  const symbolHttp = plugin.symbol("http", { external: "msw" });
  const symbolHttpResponse = plugin.symbol("HttpResponse", { external: "msw" });
  const symbolRequestHandlerOptions = plugin.symbol("RequestHandlerOptions", {
    external: "msw",
    kind: "type",
  });
  const symbolHttpRequestResolverExtras = plugin.symbol("HttpRequestResolverExtras", {
    external: "msw",
    kind: "type",
  });
  const symbolPathParams = plugin.symbol("PathParams", {
    external: "msw",
    kind: "type",
  });

  plugin.forEach("operation", ({ operation }) => {
    const { id, method, path } = operation;
    const handlerName = `${toCamelCase(id)}MockHandler`;
    const mswPath = toMswPath(path);

    const symbolResponseType = plugin.querySymbol({
      category: "type",
      resource: "operation",
      resourceId: id,
      role: "responses",
    });

    const responseSym = symbolResponseType ?? "unknown";

    // (info: HttpRequestResolverExtras<PathParams>) => Responses | Response | Promise<Responses | Response>
    const responseOrResponse = $.type.or(responseSym, "Response");
    const callbackType = $.type
      .func()
      .param("info", (p) =>
        p.type($.type(symbolHttpRequestResolverExtras).generic(symbolPathParams)),
      )
      .returns(
        $.type.or(responseSym, "Response", $.type("Promise").generic(responseOrResponse as any)),
      );

    // Responses | callback
    const overrideType = $.type.or(responseSym, callbackType as any);

    // { status?: number } & RequestHandlerOptions
    const optionsType = $.type.and(
      $.type.object().prop("status", (p) => p.optional().type("number")),
      $.type(symbolRequestHandlerOptions),
    );

    // const status = options?.status ?? 200;
    const statusStmt = $.const("status").assign(
      $("options").attr("status").optional().coalesce($.literal(200)),
    );

    // async (info) => { ... }
    const resolver = $.func()
      .async()
      .param("info")
      .do(
        // if (typeof overrideResponse === 'function') { ... }
        $.if($.typeofExpr("overrideResponse").eq($.literal("function"))).do(
          $.const("result").assign($("overrideResponse").call("info").await() as any),
          // if (result instanceof Response) return result;
          $.if($.binary("result", ts.SyntaxKind.InstanceOfKeyword, "Response")).do(
            $.return("result"),
          ),
          // return HttpResponse.json(result, { status });
          $.return(
            $(symbolHttpResponse).attr("json").call("result", $.object().prop("status", "status")),
          ),
        ),
        // if (overrideResponse !== undefined) { return HttpResponse.json(overrideResponse, { status }); }
        $.if($("overrideResponse").neq("undefined")).do(
          $.return(
            $(symbolHttpResponse)
              .attr("json")
              .call("overrideResponse", $.object().prop("status", "status")),
          ),
        ),
        // return new Response(null, { status: 501, statusText: 'Not Implemented' });
        $.return(
          $.new(
            "Response",
            $.literal(null),
            $.object()
              .prop("status", $.literal(501))
              .prop("statusText", $.literal("Not Implemented")),
          ),
        ),
      );

    // return http.METHOD('*path', resolver, options);
    const returnStmt = $.return(
      $(symbolHttp)
        .attr(method)
        .call($.literal(`*${mswPath}`), resolver, "options"),
    );

    const outerFn = $.func()
      .param("overrideResponse", (p) => p.optional().type(overrideType as any))
      .param("options", (p) => p.optional().type(optionsType as any))
      .do(statusStmt, returnStmt);

    const handlerSymbol = plugin.symbol(handlerName);
    const handlerNode = $.const(handlerSymbol)
      .export()
      .assign(outerFn as any);
    plugin.node(handlerNode);
  });
};
