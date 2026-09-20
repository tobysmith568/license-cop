import type {
  CheckLicensesResult,
  ForbiddenLicenseResult,
  NoLicenseResult
} from "@license-cop/core";
import { describe, expect, it } from "bun:test";
import type { Io } from "./io";
import { reportFailure } from "./report-failure";

const createResult = (
  noLicenses: NoLicenseResult[],
  forbiddenLicenses: ForbiddenLicenseResult[]
): CheckLicensesResult => ({
  allowedPackages: new Set(),
  allowedLicenses: new Set(),
  noLicenses: new Set(noLicenses),
  forbiddenLicenses: new Set(forbiddenLicenses)
});

const report = (result: CheckLicensesResult) => {
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];
  const io: Io = {
    stdout: line => stdoutLines.push(line),
    stderr: line => stderrLines.push(line)
  };

  reportFailure(result, io);

  return { stdoutLines, stderrLines };
};

describe("reportFailure", () => {
  it("should announce the issues on stdout", () => {
    const { stdoutLines } = report(createResult([], []));

    expect(stdoutLines).toEqual(["Found the following issues...\n"]);
  });

  it("should list packages with no license", () => {
    const { stderrLines } = report(
      createResult(
        [
          { name: "a", version: "1.0.0" },
          { name: "b", version: "2.0.0" }
        ],
        []
      )
    );

    expect(stderrLines).toEqual(["Packages with no license:", "a@1.0.0", "b@2.0.0", ""]);
  });

  it("should list packages with forbidden licenses", () => {
    const { stderrLines } = report(
      createResult(
        [],
        [{ name: "a", version: "1.0.0", licenseIdentifiers: "GPL-3.0", spdxExpression: "GPL-3.0" }]
      )
    );

    expect(stderrLines).toEqual(["Packages with forbidden licenses:", "a@1.0.0 - GPL-3.0"]);
  });

  it("should say where the forbidden license came from when the expression is different", () => {
    const { stderrLines } = report(
      createResult(
        [],
        [
          {
            name: "a",
            version: "1.0.0",
            licenseIdentifiers: "GPL-3.0",
            spdxExpression: "(MIT AND GPL-3.0)"
          }
        ]
      )
    );

    expect(stderrLines).toContain("a@1.0.0 - GPL-3.0 from (MIT AND GPL-3.0)");
  });

  it("should list both kinds of issue, packages with no license first", () => {
    const { stderrLines } = report(
      createResult(
        [{ name: "a", version: "1.0.0" }],
        [{ name: "b", version: "2.0.0", licenseIdentifiers: "GPL-3.0", spdxExpression: "GPL-3.0" }]
      )
    );

    expect(stderrLines).toEqual([
      "Packages with no license:",
      "a@1.0.0",
      "",
      "Packages with forbidden licenses:",
      "b@2.0.0 - GPL-3.0"
    ]);
  });
});
