import { describe, expect, it } from "bun:test";
import { resolveDevDependencyOptions } from "./dev-dependencies";

describe("resolveDevDependencyOptions", () => {
  const off = { includeDevDependencies: false, devDependenciesOnly: false };
  const include = { includeDevDependencies: true, devDependenciesOnly: false };
  const only = { includeDevDependencies: false, devDependenciesOnly: true };
  const both = { includeDevDependencies: true, devDependenciesOnly: true };

  describe("without the flag", () => {
    it.each([[off], [include], [only], [both]])("should use the config as it is: %p", config => {
      expect(resolveDevDependencyOptions(undefined, config)).toEqual(config);
    });
  });

  describe("with the flag", () => {
    it.each([[off], [include], [only], [both]])(
      "should include dev dependencies whatever the config says: %p",
      config => {
        expect(resolveDevDependencyOptions("include", config)).toEqual(include);
      }
    );

    it.each([[off], [include], [only], [both]])(
      "should only use dev dependencies whatever the config says: %p",
      config => {
        expect(resolveDevDependencyOptions("only", config)).toEqual(only);
      }
    );
  });
});
