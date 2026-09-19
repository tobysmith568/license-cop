import { mkdtemp, realpath, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { cliBinPath, getYarnReleasePath } from "./fixtures";
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

  // realpath: on macOS the temp dir sits behind a /var -> /private/var symlink
  const tempDirectory = await mkdtemp(join(tmpdir(), "cli-e2e-"));
  const path = await realpath(tempDirectory);

  const builtPackageJson = await packageJson.build(packageManager);
  await writeJson(join(path, "package.json"), builtPackageJson);

  const writeLicenseFile = (builder: LicenseFileBuilder) =>
    writeJson(join(path, ".licenses.json"), builder.build());

  if (licenseFile) {
    await writeLicenseFile(licenseFile);
  }

  if (
    packageManager === "yarn-3-with-node-modules" ||
    packageManager === "yarn-4-with-node-modules"
  ) {
    await writeFile(join(path, ".yarnrc.yml"), "nodeLinker: node-modules\n");
  }

  await install(packageManager, path);

  const runCli = (args: string[] = []) => runProcess("node", [cliBinPath, ...args], { cwd: path });

  const remove = async () => {
    if (process.env["KEEP_TEMP"]) {
      process.stdout.write(`Keeping e2e project at ${path}\n`);
      return;
    }

    // Retries because on Windows a just-exited child process can still hold a handle briefly
    await rm(path, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  };

  return { path, runCli, writeLicenseFile, remove };
};

const writeJson = async (path: string, contents: object) => {
  await writeFile(path, JSON.stringify(contents, null, 2));
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
    // Shell so that Windows resolves the .cmd shims these two ship as
    case "npm":
      return { command: "npm", args: ["install", "--no-audit", "--no-fund"], shell: true };
    case "pnpm":
      return { command: "pnpm", args: ["install", "--no-frozen-lockfile"], shell: true };
    case "yarn-1":
      return { command: "node", args: [getYarnReleasePath(packageManager), "install"] };
    case "yarn-3-with-node-modules":
    case "yarn-4-with-node-modules":
      return {
        command: "node",
        args: [getYarnReleasePath(packageManager), "install"],
        env: { YARN_ENABLE_IMMUTABLE_INSTALLS: "false" }
      };
    default: {
      const _exhaustiveCheck: never = packageManager;
      throw new Error(`Unknown package manager: ${_exhaustiveCheck}`);
    }
  }
};
