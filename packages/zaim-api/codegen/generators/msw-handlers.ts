type ConvertedParams = {
  functionName: string;
  responseSuccessNames: string[];
};

type OperationParams = {
  httpMethod: string;
  requestUri: string;
};

type Params = {
  operationId: string;
  convertedParams: ConvertedParams;
  operationParams: OperationParams;
};

const HEADER = [
  `import { http, HttpResponse, type StrictResponse } from "msw";`,
  `import type * as Types from "../types.js";`,
  ``,
].join("\n");

// Convert OpenAPI path template {param} to MSW :param format
function toMswPath(requestUri: string): string {
  return requestUri.replace(/\{(\w+)\}/g, ":$1");
}

function generateHandler(params: Params, varName: string): string {
  const { convertedParams, operationParams } = params;
  const { responseSuccessNames } = convertedParams;
  const { httpMethod, requestUri } = operationParams;

  const method = httpMethod.toLowerCase();
  const mswPath = toMswPath(requestUri);

  const successType =
    responseSuccessNames[0] != null ? `Types.${responseSuccessNames[0]}` : "unknown";

  return [
    `export const ${varName} = http.${method}(`,
    `  "${mswPath}",`,
    `  (): StrictResponse<${successType}> => {`,
    `    return HttpResponse.json({} as ${successType});`,
    `  },`,
    `);`,
    ``,
  ].join("\n");
}

export const mswHandlerGenerator = (paramsList: Params[]): string[] => {
  const handlerVarNames: string[] = [];

  const handlerCodes = paramsList.map((params) => {
    const varName = `${params.convertedParams.functionName}Handler`;
    handlerVarNames.push(varName);
    return generateHandler(params, varName);
  });

  const handlersExport = [
    `export const handlers = [`,
    ...handlerVarNames.map((n) => `  ${n},`),
    `];`,
    ``,
  ].join("\n");

  return [HEADER, ...handlerCodes, handlersExport];
};
