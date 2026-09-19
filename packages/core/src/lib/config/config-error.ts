export class ConfigError extends Error {
  constructor(message: string) {
    super(`Config error: ${message}`);
  }

  static fromUnknown(e: unknown): ConfigError {
    const message = resolveMessage(e);
    return new ConfigError(message);
  }
}

const resolveMessage = (e: unknown): string => {
  if (e instanceof Error) {
    return e.message;
  }

  if (typeof e === "string") {
    return e;
  }

  return "Unknown error";
};
