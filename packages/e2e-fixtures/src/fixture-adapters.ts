import { writeFile } from "fs/promises";
import { join } from "path";
import { getBunEntryPoint, getNodeEntryPoint } from "./fixtures";
import type { PackageManager } from "./package-managers";

export type Linker = "node-modules" | "pnp";

export type Overrides = Record<string, string>;

/** How to run a package manager: through `node`, or directly for ones that ship a native binary. */
export type Invocation = {
  command: string;
  args: string[];
  shell?: boolean;
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
  writeConfig?: (projectPath: string, linker: Linker) => Promise<void>;
};

// npm is the one that comes with the Node.js under test; shell so that Windows resolves its .cmd shim
const npmAdapter = (): FixtureAdapter => {
  return {
    invocation: { command: "npm", args: [], shell: true },
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

const yarnClassicAdapter = (key: PackageManager): FixtureAdapter => {
  return {
    invocation: { command: "node", args: [getNodeEntryPoint(key, "bin/yarn.js")] },
    installArgs: ["install"],
    withOverrides: (packageJson, overrides) => ({ ...packageJson, resolutions: overrides }),
    memberSpecifier: "*",
    workspaceGlobsIn: "package.json"
  };
};

const yarnModernAdapter = (key: PackageManager): FixtureAdapter => {
  return {
    ...yarnClassicAdapter(key),
    installEnv: { YARN_ENABLE_IMMUTABLE_INSTALLS: "false" },
    memberSpecifier: "workspace:*",
    // Yarn 2+ defaults to Plug'n'Play, which license-cop doesn't support, so it has to be told not to
    writeConfig: async (projectPath, linker) => {
      if (linker === "node-modules") {
        await writeFile(join(projectPath, ".yarnrc.yml"), "nodeLinker: node-modules\n");
      }
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

// A new variant (Part 5's pinned npm majors, Part 6's PnP) is one more line built from the matching
// factory above. The factories sit above this since the registry is built eagerly.
export const fixtureAdapters: Record<PackageManager, FixtureAdapter> = {
  npm: npmAdapter(),
  // pnpm 12 ships as a native binary and only keeps a Node entry point at bin/pnpm.mjs (the path
  // corepack uses); 11 has both
  "pnpm-10": pnpmAdapter("pnpm-10", "bin/pnpm.cjs"),
  "pnpm-11": pnpmAdapter("pnpm-11", "bin/pnpm.mjs"),
  "pnpm-12": pnpmAdapter("pnpm-12", "bin/pnpm.mjs"),
  "yarn-1": yarnClassicAdapter("yarn-1"),
  "yarn-3": yarnModernAdapter("yarn-3"),
  "yarn-4": yarnModernAdapter("yarn-4"),
  "bun-1-hoisted": bunAdapter("hoisted"),
  "bun-1-isolated": bunAdapter("isolated")
};
