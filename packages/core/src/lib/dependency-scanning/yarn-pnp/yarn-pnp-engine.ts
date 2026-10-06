import { join } from "node:path";
import type { PackageJsonReader } from "../../dependency/package-json-reader";
import type { Logger } from "../../logging/logger";
import type { DependencyClassifier } from "../dependency-classifier";
import { WalkingDependencyScanningEngine, type ScanContext } from "../dependency-scanning-engine";
import type { Inclusion } from "../inclusion";
import type { NormalizedNode } from "../normalized-node";
import type { PnpInstall, PnpInstallReader, PnpPackage } from "./pnp-install-reader";

/** Yarn's Plug'n'Play, which has no `node_modules`: a resolution map and zipped packages instead. */
export class YarnPnpEngine extends WalkingDependencyScanningEngine {
  constructor(
    classifier: DependencyClassifier,
    private readonly installReader: PnpInstallReader,
    // Reads through a file system that can see inside the zip archives the packages are kept in
    private readonly packageJsonReader: PackageJsonReader,
    private readonly logger: Logger
  ) {
    super(classifier);
  }

  protected async walk(context: ScanContext): Promise<NormalizedNode[]> {
    const install = await this.installReader.read(context.workingDirectory);
    const walker = new YarnPnpWalker(install, this.packageJsonReader, this.logger);

    const normalized: NormalizedNode[] = [];

    for (const pnpPackage of install.values()) {
      if (!pnpPackage.isWorkspace) {
        continue;
      }

      const nodes = await walker.normalizeWorkspace(pnpPackage, context.inclusion);
      normalized.push(...nodes);
    }

    return normalized;
  }
}

/** One scan's walk over a Plug'n'Play install. Holds the state a scan needs: what's been seen. */
class YarnPnpWalker {
  // Tracks the packages already walked, so a diamond dependency (or a genuine cycle) is only
  // expanded once; the classifier would dedupe the result by id regardless, so skipping a repeat
  // costs nothing. Keyed by Yarn's own id: the same package can be installed under several (a
  // `file:` one carries the package that asked for it).
  private readonly visited = new Set<string>();

  constructor(
    private readonly install: PnpInstall,
    private readonly packageJsonReader: PackageJsonReader,
    private readonly logger: Logger
  ) {}

  // Plug'n'Play's dependency map for a workspace doesn't say which are development ones, so which
  // to start from comes from its own package.json. Nothing installed beneath them is a development
  // dependency of anything, so there is no such thing to filter further down.
  async normalizeWorkspace(workspace: PnpPackage, inclusion: Inclusion): Promise<NormalizedNode[]> {
    const packageJsonPath = join(workspace.directory, "package.json");
    const declared = await this.packageJsonReader.readDeclaredDependencies(packageJsonPath);

    // An optional dependency that got installed is shipped like any other
    const production = inclusion.production
      ? [...declared.dependencies, ...declared.optionalDependencies]
      : [];
    const development = inclusion.development ? declared.devDependencies : [];

    const normalized: NormalizedNode[] = [];

    for (const name of [...production, ...development]) {
      const id = workspace.dependencies.get(name);

      if (id === undefined) {
        this.logger.verbose(`Skipping ${name}: it isn't installed`);
        continue;
      }

      const nodes = await this.normalizeDependency(name, id);
      normalized.push(...nodes);
    }

    return normalized;
  }

  // A workspace depended on by another is the project's own code, not a dependency of it. Its own
  // dependencies are scanned through its own entry, so there is nothing to follow into.
  private async normalizeDependency(name: string, id: string): Promise<NormalizedNode[]> {
    const pnpPackage = this.install.get(id);

    if (pnpPackage === undefined || pnpPackage.isWorkspace) {
      return [];
    }

    if (this.visited.has(id)) {
      return [];
    }
    this.visited.add(id);

    this.logger.verbose(`Parsing node: ${name}`);

    const packageJsonPath = join(pnpPackage.directory, "package.json");
    const packageJson = await this.packageJsonReader.read(packageJsonPath);

    const children: NormalizedNode[] = [];
    for (const [childName, childId] of pnpPackage.dependencies) {
      const childNodes = await this.normalizeDependency(childName, childId);
      children.push(...childNodes);
    }

    // Named as the package that asked for it names it, as arborist does, so an `npm:` alias is
    // matched by the allowed packages list under the same name whichever install shape it's in. The
    // id is not Yarn's, so that the same package installed twice is still one result.
    return [{ id: `${name}@${packageJson.version}`, name, packageJson, children }];
  }
}
