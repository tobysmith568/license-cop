import { PackageManager, TestOptions } from "./test-options";
import * as childProcess from "child_process";
import { join } from "path";

export const runTest = async (options: TestOptions) => {
  const { packageManager, directory, args, expectedExitCode } = options;

  await installDependencies(packageManager, directory);

  const testProcess = childProcess.spawn("npx", ["license-cop", ...args], {
    cwd: join("./e2e", packageManager, directory),
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

const installDependencies = async (packageManager: PackageManager, directory: string) => {
  const installProgram = getInstallProgram(packageManager);
  const installArgs = getInstallArgs(packageManager);

  const cwd = join("./e2e", packageManager, directory);

  const installProcess = childProcess.spawn(installProgram, installArgs, {
    cwd,
    shell: true
  });

  process.stdout.write(`\nInstalling dependencies with ${packageManager} in: ${cwd} \n`);

  installProcess.stdout.pipe(process.stdout);
  installProcess.stderr.pipe(process.stderr);

  await new Promise<void>(resolve => installProcess.on("exit", resolve));

  process.stdout.write("Finished installing dependencies\n");
};

const getInstallProgram = (packageManager: PackageManager): string => {
  switch (packageManager) {
    case "npm":
      return "npm";
    case "yarn-classic":
      return "yarn";
    case "yarn-modern-with-node-modules":
      return "yarn";
    default: {
      const _exhaustiveCheck: never = packageManager;
      throw new Error(`Unknown package manager: ${_exhaustiveCheck}`);
    }
  }
};

const getInstallArgs = (packageManager: PackageManager): string[] => {
  switch (packageManager) {
    case "npm":
      return ["i"];
    case "yarn-classic":
      return ["install"];
    case "yarn-modern-with-node-modules":
      return ["install"];
    default: {
      const _exhaustiveCheck: never = packageManager;
      throw new Error(`Unknown package manager: ${_exhaustiveCheck}`);
    }
  }
};
