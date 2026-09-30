import { describe, expect, it } from "bun:test";
import { BunLockError } from "./bun-lock-error";

describe("BunLockError", () => {
  it("should keep the message as it was given", () => {
    const error = new BunLockError("something broke");

    expect(error.message).toBe("something broke");
  });

  it("should be an Error with its own name", () => {
    const error = new BunLockError("x");

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("BunLockError");
  });
});
