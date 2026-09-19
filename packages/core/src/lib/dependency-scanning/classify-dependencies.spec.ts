import { describe, expect, it } from "bun:test";
import { classifyDependencies, type NormalizedNode } from "./classify-dependencies";

describe("classifyDependencies", () => {
  const classify = (
    nodes: NormalizedNode[],
    allowedLicenses: string[] = ["MIT"],
    allowedPackages: string[] = []
  ) => classifyDependencies(nodes, { allowedLicenses, allowedPackages, onVerbose: () => {} });

  const node = (
    name: string,
    license: string | undefined,
    children: NormalizedNode[] = [],
    version = "1.0.0"
  ): NormalizedNode => ({
    id: `${name}@${version}`,
    name,
    packageJson: { name, version, ...(license ? { license } : {}) },
    children
  });

  it("should return empty results when there are no nodes", () => {
    const result = classify([]);

    expect(result.allowedPackages.size).toBe(0);
    expect(result.allowedLicenses.size).toBe(0);
    expect(result.noLicenses.size).toBe(0);
    expect(result.forbiddenLicenses.size).toBe(0);
  });

  it("should classify a package with an allowed license", () => {
    const result = classify([node("a", "MIT")]);

    const [found] = [...result.allowedLicenses];
    expect(found?.name).toBe("a");
    expect(found?.spdxExpression).toBe("MIT");
    expect(result.forbiddenLicenses.size).toBe(0);
  });

  it("should classify a package with a forbidden license", () => {
    const result = classify([node("a", "GPL-3.0")]);

    expect([...result.forbiddenLicenses]).toEqual([
      { name: "a", version: "1.0.0", spdxExpression: "GPL-3.0", licenseIdentifiers: "GPL-3.0" }
    ]);
    expect(result.allowedLicenses.size).toBe(0);
  });

  it("should classify a package with no license as having no license", () => {
    const result = classify([node("a", undefined)]);

    expect([...result.noLicenses]).toEqual([{ name: "a", version: "1.0.0" }]);
  });

  it("should classify a package with an empty licenses array as having no license", () => {
    const emptyLicenses: NormalizedNode = {
      id: "a@1.0.0",
      name: "a",
      packageJson: { name: "a", version: "1.0.0", licenses: [] },
      children: []
    };

    const result = classify([emptyLicenses]);

    expect([...result.noLicenses]).toEqual([{ name: "a", version: "1.0.0" }]);
  });

  it("should classify a package in the allowed packages list regardless of its license", () => {
    const result = classify([node("a", "GPL-3.0")], ["MIT"], ["a"]);

    expect([...result.allowedPackages]).toEqual([{ name: "a", version: "1.0.0" }]);
    expect(result.forbiddenLicenses.size).toBe(0);
  });

  it("should match allowed packages by the node's name, not the package.json's name", () => {
    const aliased: NormalizedNode = { ...node("real-name", "GPL-3.0"), name: "alias" };

    const result = classify([aliased], ["MIT"], ["alias"]);

    expect(result.allowedPackages.size).toBe(1);
  });

  it("should respect the version in the allowed packages list", () => {
    const result = classify([node("a", "GPL-3.0", [], "2.0.0")], ["MIT"], ["a@1.0.0"]);

    expect(result.allowedPackages.size).toBe(0);
    expect(result.forbiddenLicenses.size).toBe(1);
  });

  it.each([
    ["allowed", node("child", "MIT")],
    ["unlicensed", node("child", undefined)],
    ["forbidden", node("child", "GPL-3.0")]
  ])("should classify the children of a package that is %s", (_kind, child) => {
    const parentLicenses = [
      ["allowed package", node("parent", "GPL-3.0", [child]), ["parent"]],
      ["licensed", node("parent", "MIT", [child]), []],
      ["unlicensed", node("parent", undefined, [child]), []],
      ["forbidden", node("parent", "GPL-3.0", [child]), []]
    ] as const;

    for (const [, parent, allowedPackages] of parentLicenses) {
      const result = classify([parent], ["MIT"], [...allowedPackages]);

      const all = [
        ...result.allowedPackages,
        ...result.allowedLicenses,
        ...result.noLicenses,
        ...result.forbiddenLicenses
      ].map(pkg => pkg.name);
      expect(all).toContain("child");
    }
  });

  it("should classify deeply nested packages", () => {
    const tree = node("a", "MIT", [node("b", "MIT", [node("c", "GPL-3.0")])]);

    const result = classify([tree]);

    expect([...result.forbiddenLicenses].map(pkg => pkg.name)).toEqual(["c"]);
    expect([...result.allowedLicenses].map(pkg => pkg.name)).toEqual(["a", "b"]);
  });

  it("should de-duplicate packages that appear more than once", () => {
    const result = classify([node("a", "MIT", [node("shared", "MIT")]), node("shared", "MIT")]);

    expect([...result.allowedLicenses].map(pkg => pkg.name)).toEqual(["a", "shared"]);
  });

  it("should treat a compound expression as allowed when every part is allowed", () => {
    const result = classify([node("a", "(MIT AND ISC)")], ["MIT", "ISC"]);

    expect(result.allowedLicenses.size).toBe(1);
  });
});
