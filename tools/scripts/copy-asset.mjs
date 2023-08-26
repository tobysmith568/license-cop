import devkit from "@nx/devkit";
import chalk from "chalk";
import { copyFile, mkdir, stat } from "fs/promises";
import { basename, join } from "path";

const { createProjectGraphAsync, readCachedProjectGraph } = devkit;

function invariant(condition, message) {
  if (!condition) {
    console.error(chalk.bold.red(message));
    process.exit(1);
  }
}

function dirExists(dir) {
  return stat(dir)
    .then(stat => stat.isDirectory())
    .catch(() => false);
}

const [, , name, assetPath] = process.argv;

await createProjectGraphAsync();
const graph = readCachedProjectGraph();
const project = graph.nodes[name];

invariant(
  project,
  `Could not find project "${name}" in the workspace. Is the project.json configured correctly?`
);

const outputDir = join(devkit.workspaceRoot, "dist", project.data.root);

const outputDirExists = await dirExists(outputDir);
if (!outputDirExists) {
  await mkdir(outputDir, { recursive: true });
}

const outputFileName = basename(assetPath);
const outputPath = join(outputDir, outputFileName);

await copyFile(assetPath, outputPath);
