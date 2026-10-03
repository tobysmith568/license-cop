import type { DependencyNode } from "@pnpm/reviewing.dependencies-hierarchy";
import { join, resolve } from "node:path";
import type { PackageJsonReader } from "../../dependency/package-json-reader";
import type { Logger } from "../../logging/logger";
import type { DependencyClassifier } from "../dependency-classifier";
import { WalkingDependencyScanningEngine, type ScanContext } from "../dependency-scanning-engine";
import type { NormalizedNode } from "../normalized-node";
import type { PnpmHierarchyReader } from "./pnpm-hierarchy-reader";
import type { PnpmProjectLocator } from "./pnpm-project-locator";

/** pnpm's virtual store. */
export class PnpmStoreEngine extends WalkingDependencyScanningEngine {
  constructor(
    classifier: DependencyClassifier,
    private readonly projectLocator: PnpmProjectLocator,
    private readonly hierarchyReader: PnpmHierarchyReader,
    private readonly packageJsonReader: PackageJsonReader,
    private readonly logger: Logger
  ) {
    super(classifier);
  }

  protected async walk(context: ScanContext): Promise<NormalizedNode[]> {
    const { workingDirectory, inclusion } = context;

    const projectPaths = await this.projectLocator.locate(workingDirectory);
    const hierarchies = await this.hierarchyReader.read(projectPaths, workingDirectory, inclusion);

    const workspaceProjectPaths = new Set(projectPaths.map(path => resolve(path)));
    const walker = new PnpmWalker(workspaceProjectPaths, this.packageJsonReader, this.logger);

    const normalizedNodes: NormalizedNode[] = [];

    for (const hierarchy of Object.values(hierarchies)) {
      const dependencies = await walker.normalizeNodes(hierarchy.dependencies);
      const devDependencies = await walker.normalizeNodes(hierarchy.devDependencies);
      const optionalDependencies = await walker.normalizeNodes(hierarchy.optionalDependencies);

      normalizedNodes.push(...dependencies, ...devDependencies, ...optionalDependencies);
    }

    return normalizedNodes;
  }
}

/** One scan's walk over pnpm's hierarchies. */
class PnpmWalker {
  constructor(
    private readonly workspaceProjectPaths: Set<string>,
    private readonly packageJsonReader: PackageJsonReader,
    private readonly logger: Logger
  ) {}

  async normalizeNodes(nodes: DependencyNode[] | undefined): Promise<NormalizedNode[]> {
    const normalized: NormalizedNode[] = [];

    for (const node of nodes ?? []) {
      const normalizedNodes = await this.normalizeNode(node);
      normalized.push(...normalizedNodes);
    }

    return normalized;
  }

  private async normalizeNode(node: DependencyNode): Promise<NormalizedNode[]> {
    this.logger.verbose(`Parsing node: ${node.name}`);

    // A workspace member that another one depends on shows up as a linked dependency. It's the
    // project's own code, not a dependency of it, so it isn't checked. Its dependencies are
    // (they're scanned through its own project too, so this only repeats them, harmlessly)
    if (this.workspaceProjectPaths.has(resolve(node.path))) {
      return await this.normalizeNodes(node.dependencies);
    }

    const packageJsonPath = join(node.path, "package.json");
    const packageJson = await this.packageJsonReader.read(packageJsonPath);
    const children = await this.normalizeNodes(node.dependencies);

    return [
      {
        id: `${node.alias}@${node.version}`,
        name: packageJson.name,
        packageJson,
        children
      }
    ];
  }
}
