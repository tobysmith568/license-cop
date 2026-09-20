import { describe, expect, it } from "bun:test";
import { cliOptions } from "./args/parse";
import { helpText } from "./help";

describe("helpText", () => {
  const options = Object.entries(cliOptions).map(([name, option]) => ({
    name,
    short: "short" in option ? option.short : undefined
  }));

  it.each(options)("should document the $name option", ({ name, short }) => {
    const text = helpText();

    expect(text).toContain(`--${name}`);

    if (short) {
      expect(text).toContain(`-${short},`);
    }
  });

  it("should document the init command", () => {
    expect(helpText()).toContain("init");
  });
});
