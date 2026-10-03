import type { Logger } from "./logger";

/** A logger that keeps what it was told, for a test to look at. */
export class RecordingLogger implements Logger {
  readonly messages: string[] = [];

  verbose(message: string): void {
    this.messages.push(message);
  }
}
