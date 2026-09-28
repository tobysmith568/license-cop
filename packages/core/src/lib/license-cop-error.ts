/**
 * The base of every failure that is down to the project or its setup rather than a bug, so that
 * callers can report `message` as it is instead of treating it as a crash.
 */
export class LicenseCopError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
