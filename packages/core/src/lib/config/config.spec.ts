import { describe, expect, it } from "bun:test";
import { parseConfig } from "./config";
import { ConfigError } from "./config-error";

describe("parseConfig", () => {
  it("should apply defaults to an empty config", () => {
    const result = parseConfig({});

    expect(result).toEqual({
      extends: undefined,
      licenses: [],
      packages: [],
      includeDevDependencies: false,
      devDependenciesOnly: false
    });
  });

  it("should keep every provided value", () => {
    const result = parseConfig({
      extends: "npm:some-config",
      licenses: ["MIT", "ISC"],
      packages: ["react@^18.0.0"],
      includeDevDependencies: true,
      devDependenciesOnly: true
    });

    expect(result).toEqual({
      extends: "npm:some-config",
      licenses: ["MIT", "ISC"],
      packages: ["react@^18.0.0"],
      includeDevDependencies: true,
      devDependenciesOnly: true
    });
  });

  it("should ignore unknown keys", () => {
    const result = parseConfig({ licenses: ["MIT"], somethingElse: true });

    expect(result).not.toHaveProperty("somethingElse");
  });

  it.each([
    ["a non-object", "MIT"],
    ["null", null],
    ["licenses that aren't an array", { licenses: "MIT" }],
    ["licenses containing non-strings", { licenses: [1] }],
    ["packages that aren't an array", { packages: "react" }],
    ["a non-boolean includeDevDependencies", { includeDevDependencies: "yes" }],
    ["a non-boolean devDependenciesOnly", { devDependenciesOnly: 1 }],
    ["a non-string extends", { extends: 1 }]
  ])("should throw a ConfigError for %s", (_name, config) => {
    expect(() => parseConfig(config)).toThrow(ConfigError);
  });
});
