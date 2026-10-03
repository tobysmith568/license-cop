import type { Link, Node } from "@npmcli/arborist";
import type { InstalledTreeLoader } from "./arborist-tree-loader";

/** The parts of one of arborist's nodes that the engine reads. */
export type FakeNode = {
  name: string;
  version: string;
  /** Where its package.json is: arborist's `realpath`. */
  path: string;
  dev?: boolean;
  isWorkspace?: boolean;
  /** Only what's nested inside it; what is hoisted next to it is the top node's, as in arborist. */
  children?: FakeNode[];
};

/** A tree loader that hands back a tree it was built with, for a test that has no `node_modules`. */
export class FakeTreeLoader implements InstalledTreeLoader {
  constructor(private readonly children: FakeNode[]) {}

  async load(): Promise<Node> {
    const top = { children: toChildren(this.children) };

    return await Promise.resolve(top as unknown as Node);
  }
}

const toChildren = (nodes: FakeNode[]): Map<string, Node | Link> => {
  const children = new Map<string, Node | Link>();

  for (const node of nodes) {
    children.set(node.name, toArboristNode(node));
  }

  return children;
};

const toArboristNode = (node: FakeNode): Node => {
  const arboristNode = {
    name: node.name,
    pkgid: `${node.name}@${node.version}`,
    realpath: node.path,
    dev: node.dev ?? false,
    isWorkspace: node.isWorkspace ?? false,
    children: toChildren(node.children ?? [])
  };

  return arboristNode as unknown as Node;
};
