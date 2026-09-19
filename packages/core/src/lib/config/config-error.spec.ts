import { describe, expect, it } from "bun:test";
import { ConfigError } from "./config-error";

describe("ConfigError", () => {
  it("should prefix the message", () => {
    const error = new ConfigError("something broke");

    expect(error.message).toBe("Config error: something broke");
  });

  it("should be an Error", () => {
    expect(new ConfigError("x")).toBeInstanceOf(Error);
  });

  describe("fromUnknown", () => {
    it("should use the message of an Error", () => {
      const error = ConfigError.fromUnknown(new Error("bad thing"));

      expect(error.message).toBe("Config error: bad thing");
    });

    it("should use a string as the message", () => {
      const error = ConfigError.fromUnknown("bad thing");

      expect(error.message).toBe("Config error: bad thing");
    });

    it.each([[undefined], [null], [42], [{ message: "not an error" }]])(
      "should fall back to a generic message for %p",
      value => {
        const error = ConfigError.fromUnknown(value);

        expect(error.message).toBe("Config error: Unknown error");
      }
    );
  });
});
