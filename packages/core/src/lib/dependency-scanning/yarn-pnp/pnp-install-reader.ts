import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import type { PlugAndPlayDetector } from "../../package-managers/plug-and-play-detector";
import { UnsupportedProjectError } from "../../unsupported-project-error";

/** One package in a Plug'n'Play install, or one of the project's own workspaces. */
export type PnpPackage = {
  /** Identifies the package within an install: yarn's own locator, e.g. `react@npm:18.3.1`. */
  id: string;
  /** Where its package.json is: absolute, and for most packages inside a zip archive. */
  directory: string;
  /** A workspace is the project's own code, not a dependency of it. */
  isWorkspace: boolean;
  /**
   * The ids of what it depends on, keyed by the name it asks for each by, which for an `npm:` alias
   * is the alias rather than the package's real name. Only what is installed is here.
   */
  dependencies: ReadonlyMap<string, string>;
};

/** Every package in an install, by id. */
export type PnpInstall = ReadonlyMap<string, PnpPackage>;

/** Reads what Yarn's Plug'n'Play resolution map says is installed. */
export interface PnpInstallReader {
  read(workingDirectory: string): Promise<PnpInstall>;
}

/** A package as the Plug'n'Play API names it. */
type PnpLocator = { name: string; reference: string };

/**
 * What a dependency is in the API's map: the reference of the package of the same name, an alias
 * (the real name and then the reference), or `null` for a peer dependency nothing provided.
 */
type PnpDependency = string | [string, string] | null;

type PnpPackageInformation = {
  packageLocation: string;
  packageDependencies: Map<string, PnpDependency>;
};

/** The part of the API a `.pnp.cjs` exports that is read: the one Yarn's own tooling resolves with. */
type PnpApi = {
  getAllLocators: () => PnpLocator[];
  getPackageInformation: (locator: PnpLocator) => PnpPackageInformation | null;
};

/**
 * Loads the project's own `.pnp.cjs`, which is generated code: Yarn writes it, but loading it runs
 * whatever it contains, as running `yarn` in the project would. It is only loaded, never set up (the
 * `setup()` that makes it take over module resolution is only called when it is preloaded).
 */
export class PnpApiInstallReader implements PnpInstallReader {
  constructor(private readonly plugAndPlayDetector: PlugAndPlayDetector) {}

  async read(workingDirectory: string): Promise<PnpInstall> {
    const plugAndPlayFile = await this.plugAndPlayDetector.find(workingDirectory);

    if (plugAndPlayFile === undefined) {
      throw new UnsupportedProjectError(
        `Cannot find a Plug'n'Play file (.pnp.cjs) in ${workingDirectory}.`
      );
    }

    const pnpPath = join(workingDirectory, plugAndPlayFile);
    const api = this.load(pnpPath, plugAndPlayFile);

    return this.toInstall(api, dirname(pnpPath));
  }

  private load(pnpPath: string, plugAndPlayFile: string): PnpApi {
    const requireFromProject = createRequire(pnpPath);

    let exported: unknown;
    try {
      exported = requireFromProject(pnpPath);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new UnsupportedProjectError(`Unable to load ${plugAndPlayFile}: ${reason}`);
    }

    if (!isPnpApi(exported)) {
      throw new UnsupportedProjectError(
        `${plugAndPlayFile} doesn't have the API license-cop reads Yarn's Plug'n'Play installs ` +
          "with. It was probably written by a version of Yarn that license-cop doesn't support."
      );
    }

    return exported;
  }

  private toInstall(api: PnpApi, projectDirectory: string): PnpInstall {
    const install = new Map<string, PnpPackage>();

    for (const locator of api.getAllLocators()) {
      const information = api.getPackageInformation(locator);

      if (information === null) {
        continue;
      }

      const id = toId(locator);
      const directory = resolve(projectDirectory, information.packageLocation);

      install.set(id, {
        id,
        directory,
        isWorkspace: locator.reference.startsWith("workspace:"),
        dependencies: toDependencies(information.packageDependencies)
      });
    }

    return install;
  }
}

const isPnpApi = (exported: unknown): exported is PnpApi => {
  const api = exported as Partial<PnpApi> | null;

  return (
    typeof api?.getAllLocators === "function" && typeof api.getPackageInformation === "function"
  );
};

const toId = (locator: PnpLocator): string => `${locator.name}@${locator.reference}`;

const toDependencies = (
  packageDependencies: Map<string, PnpDependency>
): ReadonlyMap<string, string> => {
  const dependencies = new Map<string, string>();

  for (const [name, dependency] of packageDependencies) {
    if (dependency === null) {
      continue;
    }

    const locator: PnpLocator = Array.isArray(dependency)
      ? { name: dependency[0], reference: dependency[1] }
      : { name, reference: dependency };

    dependencies.set(name, toId(locator));
  }

  return dependencies;
};
