import devkit from "@nx/devkit";
import chalk from "chalk";
import { execSync } from "child_process";
import { getLatestTag } from "npm-publish-latest-tag";

const { createProjectGraphAsync, readCachedProjectGraph } = devkit;

function invariant(condition, message) {
  if (!condition) {
    console.error(chalk.bold.red(message));
    process.exit(1);
  }
}

const [, , name] = process.argv;

await createProjectGraphAsync();
const graph = readCachedProjectGraph();
const project = graph.nodes[name];

invariant(
  project,
  `Could not find project "${name}" in the workspace. Is the project.json configured correctly?`
);

const outputDir = join(devkit.workspaceRoot, "dist", project.data.root);

process.chdir(outputDir);

const tag = await getLatestTag("./package.json");

execSync(`npm publish --access public --tag ${tag}`);
