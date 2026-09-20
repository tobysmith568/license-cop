import type { CheckLicensesResult } from "@license-cop/core";
import { describe, expect, it } from "bun:test";
import type { Io } from "./io";
import { reportSuccess } from "./report-success";

const createResult = (allowedPackages: number, allowedLicenses: number): CheckLicensesResult => ({
  allowedPackages: new Set(
    Array.from({ length: allowedPackages }, (_, i) => ({ name: `pkg-${i}`, version: "1.0.0" }))
  ),
  allowedLicenses: new Set(
    Array.from({ length: allowedLicenses }, (_, i) => ({
      name: `licensed-${i}`,
      version: "1.0.0",
      spdxExpression: "MIT",
      licenses: { type: "identifier", value: "MIT" }
    }))
  ),
  noLicenses: new Set(),
  forbiddenLicenses: new Set()
});

const report = (result: CheckLicensesResult) => {
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];
  const io: Io = {
    stdout: line => stdoutLines.push(line),
    stderr: line => stderrLines.push(line)
  };

  reportSuccess(result, io);

  return { stdoutLines, stderrLines };
};

describe("reportSuccess", () => {
  it("should only say that no issues were found when nothing was allowed explicitly", () => {
    const { stdoutLines } = report(createResult(0, 0));

    expect(stdoutLines).toEqual(["\nDone! No issues found"]);
  });

  it("should count the allowed packages", () => {
    const { stdoutLines } = report(createResult(2, 0));

    expect(stdoutLines).toEqual(["\nDone! No issues found", "Found 2 allowed packages"]);
  });

  it("should count the packages with allowed licenses", () => {
    const { stdoutLines } = report(createResult(0, 3));

    expect(stdoutLines).toEqual([
      "\nDone! No issues found",
      "Found 3 packages with allowed licenses"
    ]);
  });

  it("should report both counts", () => {
    const { stdoutLines } = report(createResult(1, 1));

    expect(stdoutLines).toEqual([
      "\nDone! No issues found",
      "Found 1 allowed packages",
      "Found 1 packages with allowed licenses"
    ]);
  });

  it("should write nothing to stderr", () => {
    const { stderrLines } = report(createResult(1, 1));

    expect(stderrLines).toEqual([]);
  });
});
