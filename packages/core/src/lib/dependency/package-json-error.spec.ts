import { describe, expect, it } from "bun:test";
import { PackageJsonError } from "./package-json-error";

describe("PackageJsonError", () => {
  it("should keep the message as it was given", () => {
    const error = new PackageJsonError("something broke");

    expect(error.message).toBe("something broke");
  });

  it("should be an Error with its own name", () => {
    const error = new PackageJsonError("x");

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("PackageJsonError");
  });
});
