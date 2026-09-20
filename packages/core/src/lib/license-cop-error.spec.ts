import { describe, expect, it } from "bun:test";
import { ConfigError } from "./config/config-error";
import { PackageJsonError } from "./dependency/package-json-error";
import { LicenseCopError } from "./license-cop-error";
import { UnsupportedProjectError } from "./unsupported-project-error";

describe("LicenseCopError", () => {
  it("should keep the message as it was given", () => {
    const error = new LicenseCopError("something broke");

    expect(error.message).toBe("something broke");
  });

  it("should be an Error", () => {
    expect(new LicenseCopError("x")).toBeInstanceOf(Error);
  });

  it("should name itself after the class that was constructed", () => {
    class FreshError extends LicenseCopError {}

    expect(new LicenseCopError("x").name).toBe("LicenseCopError");
    expect(new FreshError("x").name).toBe("FreshError");
  });

  it.each([
    ["ConfigError", ConfigError],
    ["PackageJsonError", PackageJsonError],
    ["UnsupportedProjectError", UnsupportedProjectError]
  ])("should be the base of %s", (name, ErrorClass) => {
    const error = new ErrorClass("x");

    expect(error).toBeInstanceOf(LicenseCopError);
    expect(error.name).toBe(name);
  });
});
