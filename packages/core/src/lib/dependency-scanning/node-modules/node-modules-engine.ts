import type { Link, Node } from "@npmcli/arborist";
import { join } from "node:path";
import type { PackageJsonReader } from "../../dependency/package-json-reader";
import type { Logger } from "../../logging/logger";
import type { DependencyClassifier } from "../dependency-classifier";
import { WalkingDependencyScanningEngine, type ScanContext } from "../dependency-scanning-engine";
import { isIncluded } from "../inclusion";
import type { NormalizedNode } from "../normalized-node";
import type { InstalledTreeLoader } from "./arborist-tree-loader";

/** npm's flat `node_modules`, which yarn and hoisted bun produce too. */
export class NodeModulesEngine extends WalkingDependencyScanningEngine {
  constructor(
    classifier: DependencyClassifier,
    private readonly treeLoader: InstalledTreeLoader,
    private readonly packageJsonReader: PackageJsonReader,
    private readonly logger: Logger
  ) {
    super(classifier);
  }

  protected async walk(context: ScanContext): Promise<NormalizedNode[]> {
    const topNode = await this.treeLoader.load(context.workingDirectory);
    const walker = new NodeModulesWalker(context, this.packageJsonReader, this.logger);

    return await walker.normalizeNodes(topNode.children.values());
  }
}

/** One scan's walk over arborist's tree. Dev-dependencies are filtered per node, as it's walked. */
class NodeModulesWalker {
  constructor(
    private readonly context: ScanContext,
    private readonly packageJsonReader: PackageJsonReader,
    private readonly logger: Logger
  ) {}

  async normalizeNodes(nodes: IterableIterator<Node | Link>): Promise<NormalizedNode[]> {
    const normalized: NormalizedNode[] = [];

    for (const node of nodes) {
      const normalizedNodes = await this.normalizeNode(node);
      normalized.push(...normalizedNodes);
    }

    return normalized;
  }

  private async normalizeNode(node: Node | Link): Promise<NormalizedNode[]> {
    const { inclusion } = this.context;

    this.logger.verbose(`Parsing node: ${node.name}`);

    // A workspace member is the project's own code, not a dependency of it, so it isn't checked.
    // Its dependencies are (each with its own dev flag), whether hoisted or nested inside it.
    if (node.isWorkspace) {
      return await this.normalizeNodes(node.children.values());
    }

    if (!isIncluded(inclusion, node.dev)) {
      return [];
    }

    const packageJsonPath = join(node.realpath, "package.json");
    const packageJson = await this.packageJsonReader.read(packageJsonPath);
    const children = await this.normalizeNodes(node.children.values());

    return [{ id: node.pkgid, name: node.name, packageJson, children }];
  }
}
