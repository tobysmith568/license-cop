import { describe, expect, it } from "bun:test";
import { isIncluded, toInclusion } from "./inclusion";

describe("toInclusion", () => {
  it.each([
    [false, false, true, false],
    [true, false, true, true],
    [false, true, false, true],
    [true, true, false, true]
  ])(
    "includeDevDependencies=%s devDependenciesOnly=%s should cover production=%s development=%s",
    (includeDevDependencies, devDependenciesOnly, production, development) => {
      const inclusion = toInclusion({ includeDevDependencies, devDependenciesOnly });

      expect(inclusion.production).toBe(production);
      expect(inclusion.development).toBe(development);
      expect(isIncluded(inclusion, false)).toBe(production);
      expect(isIncluded(inclusion, true)).toBe(development);
    }
  );
});
