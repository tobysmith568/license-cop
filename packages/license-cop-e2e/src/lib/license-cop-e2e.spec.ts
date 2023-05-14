import { PackageManager, TestOptions } from "./test-options";
import { runTest } from "./helpers";

describe.each<PackageManager>(["npm", "yarn-classic", "yarn-modern-with-node-modules"])(
  "%s",
  packageManager => {
    afterEach(() => process.stdout.write("\n--------------------------------\n"));

    describe("happy paths", () => {
      const expectedExitCode = 0;

      it("should pass when all licenses are present in the config", async () => {
        const options: TestOptions = {
          packageManager,
          directory: "should-pass-when-all-licenses-are-present",
          args: [],
          expectedExitCode
        };

        await runTest(options);
      });

      it("should pass when all packages are present in the config", async () => {
        const options: TestOptions = {
          packageManager,
          directory: "should-pass-when-all-packages-are-present",
          args: [],
          expectedExitCode
        };

        await runTest(options);
      });

      it("should pass when a package uses the legacy licenses field", async () => {
        const options: TestOptions = {
          packageManager,
          directory: "should-pass-when-a-package-uses-the-legacy-licenses-field",
          args: [],
          expectedExitCode
        };

        await runTest(options);
      });

      it("should pass when a package is within its semver range", async () => {
        const options: TestOptions = {
          packageManager,
          directory: "should-pass-when-a-package-is-within-its-semver-range",
          args: [],
          expectedExitCode
        };

        await runTest(options);
      });

      it("should pass when a package is specified with a ^ and is a greater minor version", async () => {
        const options: TestOptions = {
          packageManager,
          directory: "should-pass-when-a-package-is-specified-with-a-caret",
          args: [],
          expectedExitCode
        };

        await runTest(options);
      });

      it("should pass when a package is specified with a ~ and is a greater minor version", async () => {
        const options: TestOptions = {
          packageManager,
          directory: "should-pass-when-a-package-is-specified-with-a-tilde",
          args: [],
          expectedExitCode
        };

        await runTest(options);
      });
    });

    describe("unhappy paths", () => {
      const expectedExitCode = 1;

      it("should fail when the license of a direct dependency is missing from the config", async () => {
        const options: TestOptions = {
          packageManager,
          directory: "should-fail-when-a-license-is-missing",
          args: [],
          expectedExitCode
        };

        await runTest(options);
      });

      it("should fail when the license of an indirect dependency is missing from the config", async () => {
        const options: TestOptions = {
          packageManager,
          directory: "should-fail-when-the-license-of-a-dep-of-a-dep-is-missing",
          args: [],
          expectedExitCode
        };

        await runTest(options);
      });

      it("should fail when a package is missing from the config", async () => {
        const options: TestOptions = {
          packageManager,
          directory: "should-fail-when-a-package-is-missing",
          args: [],
          expectedExitCode
        };

        await runTest(options);
      });

      it("should fail when a package is out of its semver range", async () => {
        const options: TestOptions = {
          packageManager,
          directory: "should-fail-when-a-package-is-out-of-its-semver-range",
          args: [],
          expectedExitCode
        };

        await runTest(options);
      });

      it("should fail when a package is specified with a ^ and is a lesser minor version", async () => {
        const options: TestOptions = {
          packageManager,
          directory: "should-fail-when-a-package-is-specified-with-a-caret",
          args: [],
          expectedExitCode
        };

        await runTest(options);
      });

      it("should fail when a package is specified with a ~ and is a lesser patch version", async () => {
        const options: TestOptions = {
          packageManager,
          directory: "should-fail-when-a-package-is-specified-with-a-tilde",
          args: [],
          expectedExitCode
        };

        await runTest(options);
      });
    });
  }
);
