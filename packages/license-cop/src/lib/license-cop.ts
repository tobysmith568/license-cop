import Arborist, { Node, Link } from "@npmcli/arborist";
import { isAbsolute, join } from "path";
import { readPackageJson } from "./package-json";

export const checkLicenses = async (workingDir?: string): Promise<void> => {
  console.log("Checking licenses");

  const licenses = new Set<string>();

  const path = resolvePath(workingDir);

  const arborist = new Arborist({
    path
  });

  const topNode = await arborist.loadActual();

  console.log("Top node:", topNode.name);

  const parseNodes = async (nodes: IterableIterator<Node | Link>) => {
    for (const node of nodes) {
      if (node.dev || node.devOptional) {
        continue;
      }

      const packageJsonPath = join(node.realpath, "package.json");
      const { license } = await readPackageJson(packageJsonPath);

      if (license) {
        licenses.add(license);
      }

      if (node.children.size > 0) {
        parseNodes(node.children.values());
      }
    }
  };

  await parseNodes(topNode.children.values());

  console.log("Licenses:");
  for (const license of licenses) {
    console.log(`- ${license}`);
  }
};

const resolvePath = (path?: string): string => {
  if (!path) {
    return process.cwd();
  }

  return isAbsolute(path) ? path : join(process.cwd(), path);
};
