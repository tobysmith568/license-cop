import { join } from "node:path";
import { BunLock, bunLockSchema } from "./bun-lock";
import { BunLockError } from "./bun-lock-error";
import { JsonFileReader } from "./json-file-reader";

export interface BunLockReader {
  read(workingDirectory: string): Promise<BunLock>;
}

export class FileBunLockReader extends JsonFileReader implements BunLockReader {
  protected readonly description = "bun.lock";

  async read(workingDirectory: string): Promise<BunLock> {
    const path = join(workingDirectory, "bun.lock");

    const raw = await this.readJson(path);
    const data = this.validate(bunLockSchema, raw, path);

    return new BunLock(data.workspaces);
  }

  protected createError(message: string): Error {
    return new BunLockError(message);
  }
}
