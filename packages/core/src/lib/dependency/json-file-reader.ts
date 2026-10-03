import type { z } from "zod";
import type { Logger } from "../logging/logger";
import type { FileSystem } from "../utils/file-system";
import { json5Parse } from "../utils/json5";

/**
 * What reading a JSON5 file and checking its shape has in common, whichever file it is: only the
 * name it is reported under, and the error it is reported with, differ.
 */
export abstract class JsonFileReader {
  /** What the file is called in messages, e.g. `package.json`. */
  protected abstract readonly description: string;

  protected abstract createError(message: string): Error;

  constructor(
    private readonly fileSystem: FileSystem,
    private readonly logger: Logger
  ) {}

  protected async readJson(path: string): Promise<unknown> {
    const exists = await this.fileSystem.fileExists(path);
    if (!exists) {
      this.logger.verbose(`Cannot find the ${this.description}: '${path}'`);
      throw this.createError(`Cannot find the file: '${path}'`);
    }

    const contents = await this.fileSystem.readText(path);

    try {
      return json5Parse<unknown>(contents);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw this.createError(`Unable to parse ${this.description}: ${path}: ${reason}`);
    }
  }

  protected validate<T>(schema: z.ZodType<T>, raw: unknown, path: string): T {
    const parsed = schema.safeParse(raw);

    if (!parsed.success) {
      throw this.createError(
        `Unable to parse ${this.description}: ${path}: ${parsed.error.message}`
      );
    }

    return parsed.data;
  }
}
