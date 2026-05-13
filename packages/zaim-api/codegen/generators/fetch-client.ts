const BASE_URL = "https://api.zaim.net";

type PickedParameter = {
  name: string;
  in: string;
  required: boolean;
};

type ConvertedParams = {
  functionName: string;
  parameterName: string;
  responseSuccessNames: string[];
  pickedParameters: PickedParameter[];
  hasParameter: boolean;
  hasQueryParameters: boolean;
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
  `import type * as Types from "../types.js";`,
  ``,
  `const BASE_URL = "${BASE_URL}";`,
  ``,
  `export type RequestOptions = Omit<RequestInit, "method" | "body">;`,
  ``,
].join("\n");

function generateFunction(params: Params): string {
  const { convertedParams, operationParams } = params;
  const {
    functionName,
    parameterName,
    responseSuccessNames,
    pickedParameters,
    hasParameter,
    hasQueryParameters,
  } = convertedParams;
  const { httpMethod, requestUri } = operationParams;

  const pathParamNames = pickedParameters.filter((p) => p.in === "path").map((p) => p.name);

  const returnType =
    responseSuccessNames[0] != null ? `Types.${responseSuccessNames[0]}` : "unknown";

  const paramsArg = hasParameter ? `params: Types.${parameterName}, ` : "";

  // Build URL with path params substituted
  const urlWithPathParams = requestUri.replace(/\{(\w+)\}/g, (_m, n: string) => `\${params.${n}}`);

  let urlCode: string;
  if (hasQueryParameters) {
    const pathKeysJson = JSON.stringify(pathParamNames);
    urlCode = [
      `  const _url = new URL(\`\${BASE_URL}${urlWithPathParams}\`);`,
      `  const _pathKeys = new Set<string>(${pathKeysJson});`,
      `  for (const [k, v] of Object.entries(params as Record<string, unknown>)) {`,
      `    if (!_pathKeys.has(k) && v != null) _url.searchParams.set(k, String(v));`,
      `  }`,
    ].join("\n");
  } else {
    urlCode = `  const _url = new URL(\`\${BASE_URL}${urlWithPathParams}\`);`;
  }

  return [
    `export const ${functionName} = async (`,
    `  ${paramsArg}options?: RequestOptions`,
    `): Promise<${returnType}> => {`,
    urlCode,
    `  const response = await fetch(_url.toString(), { method: "${httpMethod}", ...options });`,
    `  if (!response.ok) throw new Error(\`HTTP \${response.status}\`);`,
    `  return response.json() as Promise<${returnType}>;`,
    `};`,
    ``,
  ].join("\n");
}

export const fetchClientGenerator = (paramsList: Params[]): string[] => {
  return [HEADER, ...paramsList.map((p) => generateFunction(p))];
};
