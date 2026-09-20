import { createTempDir, writeJson } from "@license-cop/test-utils";
import { writeFile } from "fs/promises";
import { join } from "path";
import { cliBinPath, getPackageManagerEntryPoint } from "./fixtures";
import type { LicenseFileBuilder } from "./license-file-builder";
import type { PackageJsonBuilder } from "./package-json-builder";
import type { PackageManager } from "./package-managers";
import type { ProcessResult } from "./run-process";
import { runProcess } from "./run-process";

export interface ProjectOptions {
  packageManager: PackageManager;
  packageJson: PackageJsonBuilder;
  licenseFile?: LicenseFileBuilder;
}

export interface Project {
  path: string;
  runCli: (args?: string[]) => Promise<ProcessResult>;
  writeLicenseFile: (builder: LicenseFileBuilder) => Promise<void>;
  remove: () => Promise<void>;
}

/**
 * Writes a project into a fresh temp dir and installs it with the real package manager, so the
 * on-disk state license-cop reads is genuinely produced by that package manager. Set `KEEP_TEMP=1`
 * to leave the directory behind (its path is logged) for inspecting after a failure.
 */
export const createProject = async (options: ProjectOptions): Promise<Project> => {
  const { packageManager, packageJson, licenseFile } = options;

  const tempDir = await createTempDir({ prefix: "cli-e2e-" });
  const path = tempDir.path;

  const builtPackageJson = await packageJson.build(packageManager);
  await writeJson(join(path, "package.json"), builtPackageJson);

  const writeLicenseFile = (builder: LicenseFileBuilder) =>
    writeJson(join(path, ".licenses.json"), builder.build());

  if (licenseFile) {
    await writeLicenseFile(licenseFile);
  }

  // license-cop reads node_modules, so yarn 2+ has to be told not to use Plug'n'Play
  if (packageManager === "yarn-3" || packageManager === "yarn-4") {
    await writeFile(join(path, ".yarnrc.yml"), "nodeLinker: node-modules\n");
  }

  await install(packageManager, path);

  const runCli = (args: string[] = []) => runProcess("node", [cliBinPath, ...args], { cwd: path });

  const remove = () => tempDir.remove();

  return { path, runCli, writeLicenseFile, remove };
};

const install = async (packageManager: PackageManager, cwd: string) => {
  const { command, args, env, shell } = getInstallCommand(packageManager);

  const result = await runProcess(command, args, { cwd, env, shell });

  if (result.exitCode !== 0) {
    throw new Error(`\`${command} ${args.join(" ")}\` failed in ${cwd}:\n${result.output}`);
  }
};

interface InstallCommand {
  command: string;
  args: string[];
  env?: Record<string, string>;
  shell?: boolean;
}

// Each project is installed fresh, so CI's default of refusing to write a lockfile has to be off
const getInstallCommand = (packageManager: PackageManager): InstallCommand => {
  switch (packageManager) {
    // npm is the one that comes with the Node.js under test; shell so that Windows resolves its .cmd shim
    case "npm":
      return { command: "npm", args: ["install", "--no-audit", "--no-fund"], shell: true };
    case "pnpm-10":
    case "pnpm-11":
    case "pnpm-12":
      return {
        command: "node",
        args: [getPackageManagerEntryPoint(packageManager), "install", "--no-frozen-lockfile"]
      };
    case "yarn-1":
      return { command: "node", args: [getPackageManagerEntryPoint(packageManager), "install"] };
    case "yarn-3":
    case "yarn-4":
      return {
        command: "node",
        args: [getPackageManagerEntryPoint(packageManager), "install"],
        env: { YARN_ENABLE_IMMUTABLE_INSTALLS: "false" }
      };
    default: {
      const _exhaustiveCheck: never = packageManager;
      throw new Error(`Unknown package manager: ${_exhaustiveCheck}`);
    }
  }
};
