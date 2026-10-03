import type { OnVerbose } from "../on-verbose";

/** Where the progress a caller may want to follow is reported. */
export interface Logger {
  verbose(message: string): void;
}

/** Reports to the callback a caller of the public API gave. */
export class CallbackLogger implements Logger {
  constructor(private readonly onVerbose: OnVerbose) {}

  verbose(message: string): void {
    this.onVerbose(message);
  }
}

export class NullLogger implements Logger {
  verbose(): void {}
}
