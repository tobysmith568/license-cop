import * as childProcess from "child_process";

describe("license-cop-e2e", () => {
  describe("happy paths", () => {
    const expectedExitCode = 0;

    it("should pass when all licenses are present in the config", async () => {
      const options: TestOptions = {
        directory: "should-pass-when-all-licenses-are-present",
        args: [],
        expectedExitCode
      };

      await installDependencies(options);
      await runTest(options);
    });

    it("should pass when all packages are present in the config", async () => {
      const options: TestOptions = {
        directory: "should-pass-when-all-packages-are-present",
        args: [],
        expectedExitCode
      };

      await installDependencies(options);
      await runTest(options);
    });

    it("should pass when a package is within its semver range", async () => {
      const options: TestOptions = {
        directory: "should-pass-when-a-package-is-within-its-semver-range",
        args: [],
        expectedExitCode
      };

      await installDependencies(options);
      await runTest(options);
    });

    it("should pass when a package is specified with a ^ and is a greater minor version", async () => {
      const options: TestOptions = {
        directory: "should-pass-when-a-package-is-specified-with-a-caret",
        args: [],
        expectedExitCode
      };

      await installDependencies(options);
      await runTest(options);
    });

    it("should pass when a package is specified with a ~ and is a greater minor version", async () => {
      const options: TestOptions = {
        directory: "should-pass-when-a-package-is-specified-with-a-tilde",
        args: [],
        expectedExitCode
      };

      await installDependencies(options);
      await runTest(options);
    });
  });

  describe("unhappy paths", () => {
    const expectedExitCode = 1;

    it("should fail when a license is missing from the config", async () => {
      const options: TestOptions = {
        directory: "should-fail-when-a-license-is-missing",
        args: [],
        expectedExitCode
      };

      await installDependencies(options);
      await runTest(options);
    });

    it("should fail when a package is missing from the config", async () => {
      const options: TestOptions = {
        directory: "should-fail-when-a-package-is-missing",
        args: [],
        expectedExitCode
      };

      await installDependencies(options);
      await runTest(options);
    });

    it("should fail when a package is out of its semver range", async () => {
      const options: TestOptions = {
        directory: "should-fail-when-a-package-is-out-of-its-semver-range",
        args: [],
        expectedExitCode
      };

      await installDependencies(options);
      await runTest(options);
    });

    it("should fail when a package is specified with a ^ and is a lesser minor version", async () => {
      const options: TestOptions = {
        directory: "should-fail-when-a-package-is-specified-with-a-caret",
        args: [],
        expectedExitCode
      };

      await installDependencies(options);
      await runTest(options);
    });

    it("should fail when a package is specified with a ~ and is a lesser patch version", async () => {
      const options: TestOptions = {
        directory: "should-fail-when-a-package-is-specified-with-a-tilde",
        args: [],
        expectedExitCode
      };

      await installDependencies(options);
      await runTest(options);
    });
  });
});

interface TestOptions {
  directory: string;
  args: string[];
  expectedExitCode: number;
}

const installDependencies = async (options: TestOptions) => {
  const { directory } = options;

  const installProcess = childProcess.spawn("npm", ["ci"], {
    cwd: `./e2e/${directory}`,
    shell: true
  });

  process.stdout.write(`\nInstalling dependencies in: ${directory} \n`);

  installProcess.stdout.pipe(process.stdout);
  installProcess.stderr.pipe(process.stderr);

  await new Promise<void>(resolve => installProcess.on("exit", resolve));

  process.stdout.write("Finished installing dependencies\n");
};

const runTest = async (options: TestOptions) => {
  const { directory, args, expectedExitCode } = options;

  const testProcess = childProcess.spawn("npx", ["license-cop", ...args], {
    cwd: `./e2e/${directory}`,
    shell: true
  });

  process.stdout.write("\nStart of test output\n");

  testProcess.stdout.pipe(process.stdout);
  testProcess.stderr.pipe(process.stderr);

  const exitCode = await new Promise<number>(resolve => {
    testProcess.on("exit", (exitCode: number) => {
      process.stdout.write("End of test output\n");
      resolve(exitCode);
    });
  });

  expect(exitCode).toBe(expectedExitCode);
};
