/** OpenAPI の {param} を MSW の :param 形式に変換する */
export function toMswPath(path: string): string {
  return path.replace(
    /\{([^}]+)\}/g,
    (_, name: string) => `:${name.replace(/[^a-zA-Z0-9_]/g, "")}`,
  );
}

export function toCamelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}
