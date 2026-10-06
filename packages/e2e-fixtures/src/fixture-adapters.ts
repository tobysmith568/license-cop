import { writeFile } from "fs/promises";
import { join } from "path";
import { getBunEntryPoint, getNodeEntryPoint } from "./fixtures";
import type { PackageManager } from "./package-managers";

/** What yarn 2+ installs to: a node_modules like npm's, or Plug'n'Play's resolution map. */
export type YarnLinker = "node-modules" | "pnp";

export type Overrides = Record<string, string>;

/** How to run a package manager: through `node`, or directly for ones that ship a native binary. */
export type Invocation = {
  command: string;
  args: string[];
};

/** Everything that differs between the package managers a fixture project can be installed with. */
export type FixtureAdapter = {
  invocation: Invocation;
  installArgs: string[];
  installEnv?: Record<string, string>;
  /** Spreads the package.json fields that pin transitive dependencies, spelled the way this one does. */
  withOverrides: (packageJson: object, overrides: Overrides) => object;
  /** What a workspace member is depended on as: a plain range works for npm and yarn 1 only. */
  memberSpecifier: "*" | "workspace:*";
  workspaceGlobsIn: "package.json" | "pnpm-workspace.yaml";
  /** Config files that have to exist before installing, e.g. to force a linker. */
  writeConfig?: (projectPath: string) => Promise<void>;
};

const npmAdapter = (key: PackageManager): FixtureAdapter => {
  return {
    invocation: { command: "node", args: [getNodeEntryPoint(key, "bin/npm-cli.js")] },
    installArgs: ["install", "--no-audit", "--no-fund"],
    withOverrides: (packageJson, overrides) => ({ ...packageJson, overrides }),
    memberSpecifier: "*",
    workspaceGlobsIn: "package.json"
  };
};

// Each project is installed fresh, so CI's default of refusing to write a lockfile has to be off
const pnpmAdapter = (key: PackageManager, entryPoint: string): FixtureAdapter => {
  return {
    invocation: { command: "node", args: [getNodeEntryPoint(key, entryPoint)] },
    installArgs: ["install", "--no-frozen-lockfile"],
    withOverrides: (packageJson, overrides) => ({ ...packageJson, pnpm: { overrides } }),
    memberSpecifier: "workspace:*",
    workspaceGlobsIn: "pnpm-workspace.yaml"
  };
};

// The alias is the one the package manager is pinned under in package.json, which a variant that
// only differs in its linker shares with the one it's a variant of
const yarnClassicAdapter = (alias: string): FixtureAdapter => {
  return {
    invocation: { command: "node", args: [getNodeEntryPoint(alias, "bin/yarn.js")] },
    installArgs: ["install"],
    withOverrides: (packageJson, overrides) => ({ ...packageJson, resolutions: overrides }),
    memberSpecifier: "*",
    workspaceGlobsIn: "package.json"
  };
};

// Yarn 2+ defaults to Plug'n'Play, but each entry forces its own linker explicitly, as bun's do,
// rather than relying on that default
const yarnModernAdapter = (alias: string, linker: YarnLinker): FixtureAdapter => {
  return {
    ...yarnClassicAdapter(alias),
    installEnv: { YARN_ENABLE_IMMUTABLE_INSTALLS: "false" },
    memberSpecifier: "workspace:*",
    writeConfig: async projectPath => {
      await writeFile(join(projectPath, ".yarnrc.yml"), `nodeLinker: ${linker}\n`);
    }
  };
};

// bun's own ambient default varies by project shape (hoisted for a single package, isolated for a
// workspace), so each entry forces its own linker explicitly rather than relying on that default,
// which would otherwise make the same nominal entry run a different engine in different fixtures.
// bun happily writes a fresh lockfile with no extra flag, even under CI.
const bunAdapter = (bunLinker: "hoisted" | "isolated"): FixtureAdapter => {
  return {
    invocation: { command: getBunEntryPoint(), args: [] },
    installArgs: ["install"],
    withOverrides: (packageJson, overrides) => ({ ...packageJson, overrides }),
    memberSpecifier: "workspace:*",
    workspaceGlobsIn: "package.json",
    writeConfig: async projectPath => {
      await writeFile(join(projectPath, "bunfig.toml"), `[install]\nlinker = "${bunLinker}"\n`);
    }
  };
};

// A new variant is one more line built from the matching factory above. The factories sit above
// this since the registry is built eagerly.
export const fixtureAdapters: Record<PackageManager, FixtureAdapter> = {
  "npm-10": npmAdapter("npm-10"),
  "npm-11": npmAdapter("npm-11"),
  "npm-12": npmAdapter("npm-12"),
  // pnpm 12 ships as a native binary and only keeps a Node entry point at bin/pnpm.mjs (the path
  // corepack uses); 11 has both
  "pnpm-10": pnpmAdapter("pnpm-10", "bin/pnpm.cjs"),
  "pnpm-11": pnpmAdapter("pnpm-11", "bin/pnpm.mjs"),
  "pnpm-12": pnpmAdapter("pnpm-12", "bin/pnpm.mjs"),
  "yarn-1": yarnClassicAdapter("yarn-1"),
  "yarn-3": yarnModernAdapter("yarn-3", "node-modules"),
  "yarn-3-pnp": yarnModernAdapter("yarn-3", "pnp"),
  "yarn-4": yarnModernAdapter("yarn-4", "node-modules"),
  "yarn-4-pnp": yarnModernAdapter("yarn-4", "pnp"),
  "bun-1-hoisted": bunAdapter("hoisted"),
  "bun-1-isolated": bunAdapter("isolated")
};
