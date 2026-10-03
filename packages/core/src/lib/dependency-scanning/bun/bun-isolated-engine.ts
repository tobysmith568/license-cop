import { join } from "node:path";
import type { BunLock } from "../../dependency/bun-lock";
import type { BunLockReader } from "../../dependency/bun-lock-reader";
import type { PackageJsonReader } from "../../dependency/package-json-reader";
import type { Logger } from "../../logging/logger";
import type { DependencyClassifier } from "../dependency-classifier";
import { WalkingDependencyScanningEngine, type ScanContext } from "../dependency-scanning-engine";
import type { NormalizedNode } from "../normalized-node";
import type { BunStoreResolver } from "./bun-store-resolver";

/** bun's isolated linker (`[install] linker = "isolated"`), modeled on pnpm's virtual store. */
export class BunIsolatedEngine extends WalkingDependencyScanningEngine {
  constructor(
    classifier: DependencyClassifier,
    private readonly lockReader: BunLockReader,
    private readonly storeResolver: BunStoreResolver,
    private readonly packageJsonReader: PackageJsonReader,
    private readonly logger: Logger
  ) {
    super(classifier);
  }

  protected async walk(context: ScanContext): Promise<NormalizedNode[]> {
    const { workingDirectory, inclusion } = context;

    const lock = await this.lockReader.read(workingDirectory);
    const walker = new BunIsolatedWalker(
      context,
      lock,
      this.storeResolver,
      this.packageJsonReader,
      this.logger
    );

    const normalizedNodes: NormalizedNode[] = [];

    for (const [memberPath, workspace] of lock.members()) {
      // Dev-dependencies are filtered upstream here, via which of a workspace's dependency maps get
      // walked. An optional dependency that got installed is shipped like any other.
      const dependencies = inclusion.production
        ? { ...workspace.dependencies, ...workspace.optionalDependencies }
        : {};
      const devDependencies = inclusion.development ? (workspace.devDependencies ?? {}) : {};

      const production = await walker.normalizeRootDependencies(memberPath, dependencies);
      const development = await walker.normalizeRootDependencies(memberPath, devDependencies);

      normalizedNodes.push(...production, ...development);
    }

    return normalizedNodes;
  }
}

/** One scan's walk over bun's store. Holds the state a scan needs: the lock and what's been seen. */
class BunIsolatedWalker {
  // Tracks store directories already walked, so a diamond dependency (or a genuine cycle, which
  // nothing downstream here otherwise guards against) is only expanded once; the classifier would
  // dedupe the result by id regardless, so skipping a repeat costs nothing.
  private readonly visited = new Set<string>();

  constructor(
    private readonly context: ScanContext,
    private readonly lock: BunLock,
    private readonly storeResolver: BunStoreResolver,
    private readonly packageJsonReader: PackageJsonReader,
    private readonly logger: Logger
  ) {}

  async normalizeRootDependencies(
    memberPath: string,
    dependencies: Record<string, string>
  ): Promise<NormalizedNode[]> {
    const containerDir = join(this.context.workingDirectory, memberPath);

    const normalized: NormalizedNode[] = [];
    for (const [name, specifier] of Object.entries(dependencies)) {
      const nodes = await this.normalizeRootDependency(name, specifier, containerDir);
      normalized.push(...nodes);
    }

    return normalized;
  }

  // A workspace member linked in as a dependency (`"workspace:*"`) is the project's own code, not a
  // dependency of it, so it isn't checked. Its own dependencies are (they're also scanned through
  // its own project entry, so this only repeats them, harmlessly).
  private async normalizeRootDependency(
    name: string,
    specifier: string,
    containerDir: string
  ): Promise<NormalizedNode[]> {
    if (specifier.startsWith("workspace:")) {
      const memberPath = this.lock.pathOfWorkspaceNamed(name);
      return memberPath === undefined ? [] : await this.normalizeWorkspaceDependencies(memberPath);
    }

    return await this.buildNode(name, containerDir);
  }

  private async normalizeWorkspaceDependencies(memberPath: string): Promise<NormalizedNode[]> {
    const workspace = this.lock.workspaceAt(memberPath);
    if (!workspace) {
      return [];
    }

    const dependencies = { ...workspace.dependencies, ...workspace.optionalDependencies };

    return await this.normalizeRootDependencies(memberPath, dependencies);
  }

  private async buildNode(name: string, containerDir: string): Promise<NormalizedNode[]> {
    this.logger.verbose(`Parsing node: ${name}`);

    const resolvedDir = await this.storeResolver.resolvePackageDir(containerDir, name);
    if (!resolvedDir) {
      return [];
    }

    if (this.visited.has(resolvedDir)) {
      return [];
    }
    this.visited.add(resolvedDir);

    const packageJsonPath = join(resolvedDir, "package.json");
    const packageJson = await this.packageJsonReader.read(packageJsonPath);
    const declared = await this.packageJsonReader.readDeclaredDependencies(packageJsonPath);
    const childContainer = this.storeResolver.storeRootFor(resolvedDir, name);

    const children: NormalizedNode[] = [];
    for (const childName of [...declared.dependencies, ...declared.optionalDependencies]) {
      const childNodes = await this.buildNode(childName, childContainer);
      children.push(...childNodes);
    }

    return [
      {
        id: `${packageJson.name}@${packageJson.version}`,
        name: packageJson.name,
        packageJson,
        children
      }
    ];
  }
}
