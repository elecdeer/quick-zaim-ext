export class ExtractError extends Error {
  static {
    // biome-ignore lint/complexity/noThisInStatic: <explanation>
    this.prototype.name = "ExtractError";
  }

  constructor(
    {
      message,
      element,
    }: {
      message: string;
      element?: HTMLElement | HTMLElement[] | undefined;
    },
    options?: ErrorOptions
  ) {
    super(message, options);
  }
}
