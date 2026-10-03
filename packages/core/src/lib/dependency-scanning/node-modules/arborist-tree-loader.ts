import Arborist, { type Node } from "@npmcli/arborist";

/** Reads the tree of what is actually installed in a project's `node_modules`. */
export interface InstalledTreeLoader {
  load(workingDirectory: string): Promise<Node>;
}

export class ArboristTreeLoader implements InstalledTreeLoader {
  async load(workingDirectory: string): Promise<Node> {
    const arborist = new Arborist({ path: workingDirectory });

    return await arborist.loadActual();
  }
}
