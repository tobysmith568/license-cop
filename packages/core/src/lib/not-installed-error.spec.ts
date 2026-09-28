import { describe, expect, it } from "bun:test";
import { LicenseCopError } from "./license-cop-error";
import { NotInstalledError } from "./not-installed-error";

describe("NotInstalledError", () => {
  it("should keep the message as it was given", () => {
    const error = new NotInstalledError("run an install");

    expect(error.message).toBe("run an install");
  });

  it("should be a LicenseCopError with its own name", () => {
    const error = new NotInstalledError("x");

    expect(error).toBeInstanceOf(LicenseCopError);
    expect(error.name).toBe("NotInstalledError");
  });
});
