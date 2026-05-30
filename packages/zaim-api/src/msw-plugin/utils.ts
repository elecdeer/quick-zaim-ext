/** OpenAPI の {param} を MSW の :param 形式に変換する */
export const toMswPath = (path: string): string =>
  path.replace(/\{([^}]+)\}/g, (_, name: string) => `:${name.replace(/[^a-zA-Z0-9_]/g, "")}`);

export const toCamelCase = (str: string): string => str.charAt(0).toLowerCase() + str.slice(1);
