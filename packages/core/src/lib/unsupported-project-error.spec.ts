import { describe, expect, it } from "bun:test";
import { UnsupportedProjectError } from "./unsupported-project-error";

describe("UnsupportedProjectError", () => {
  it("should keep the message as it was given", () => {
    const error = new UnsupportedProjectError("nope");

    expect(error.message).toBe("nope");
  });

  it("should be an Error with its own name", () => {
    const error = new UnsupportedProjectError("x");

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("UnsupportedProjectError");
  });
});
