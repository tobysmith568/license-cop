import { createTempDir, writeJson } from "@license-cop/test-utils";
import { writeFile } from "fs/promises";
import { join } from "path";
import { fixtureAdapters, type FixtureAdapter, type Linker } from "./fixture-adapters";
import type { LicenseFileBuilder } from "./license-file-builder";
import type { PackageJsonBuilder } from "./package-json-builder";
import type { PackageManager } from "./package-managers";
import { runProcess } from "./run-process";

export interface ProjectOptions {
  packageManager: PackageManager;
  packageJson: PackageJsonBuilder;
  licenseFile?: LicenseFileBuilder;
  /**
   * Which linker yarn 2+ installs with. License-cop reads `node_modules`, so that's the default;
   * `pnp` is only for testing that it's refused.
   */
  linker?: Linker;
  /**
   * Makes the project a workspace root, with one member per entry (keyed by its directory name,
   * under `packages/`). The members are named after their directory and, like most real ones,
   * have no license of their own.
   */
  members?: Record<string, PackageJsonBuilder>;
}

export interface Project {
  path: string;
  /** The directory of a member, as given in `ProjectOptions.members`. */
  memberPath: (name: string) => string;
  writeLicenseFile: (builder: LicenseFileBuilder) => Promise<void>;
  remove: () => Promise<void>;
}

const membersDirectory = "packages";

/**
 * Writes a project into a fresh temp dir and installs it with the real package manager, so the
 * on-disk state license-cop reads is genuinely produced by that package manager. Set `KEEP_TEMP=1`
 * to leave the directory behind (its path is logged) for inspecting after a failure.
 */
export const createProject = async (options: ProjectOptions): Promise<Project> => {
  const { packageManager, packageJson, licenseFile, linker = "node-modules", members } = options;

  const tempDir = await createTempDir({ prefix: "e2e-fixtures-" });
  const path = tempDir.path;

  const builtPackageJson = await packageJson.build(packageManager);
  const isWorkspace = members !== undefined;

  const adapter = fixtureAdapters[packageManager];

  // pnpm keeps its workspace globs in its own file; npm and yarn keep them in the package.json
  const usesWorkspacesField = isWorkspace && adapter.workspaceGlobsIn === "package.json";
  const rootPackageJson = usesWorkspacesField
    ? { ...builtPackageJson, workspaces: [`${membersDirectory}/*`] }
    : builtPackageJson;
  await writeJson(join(path, "package.json"), rootPackageJson);

  if (isWorkspace && adapter.workspaceGlobsIn === "pnpm-workspace.yaml") {
    await writeFile(join(path, "pnpm-workspace.yaml"), `packages:\n  - "${membersDirectory}/*"\n`);
  }

  for (const [name, memberPackageJson] of Object.entries(members ?? {})) {
    const builtMember = await memberPackageJson.build(packageManager);
    await writeJson(join(path, membersDirectory, name, "package.json"), {
      ...builtMember,
      name: `member-${name}`
    });
  }

  const writeLicenseFile = (builder: LicenseFileBuilder) =>
    writeJson(join(path, ".licenses.json"), builder.build());

  if (licenseFile) {
    await writeLicenseFile(licenseFile);
  }

  await adapter.writeConfig?.(path, linker);

  await install(adapter, path);

  const remove = () => tempDir.remove();

  const memberPath = (name: string) => join(path, membersDirectory, name);

  return { path, memberPath, writeLicenseFile, remove };
};

const install = async (adapter: FixtureAdapter, cwd: string) => {
  const { invocation, installArgs, installEnv } = adapter;
  const { command, shell } = invocation;
  const args = [...invocation.args, ...installArgs];

  const result = await runProcess(command, args, { cwd, env: installEnv, shell });

  if (result.exitCode !== 0) {
    throw new Error(`\`${command} ${args.join(" ")}\` failed in ${cwd}:\n${result.output}`);
  }
};
