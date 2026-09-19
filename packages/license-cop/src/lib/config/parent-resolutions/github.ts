import { GitHubClient } from "git-filesystem";
import logger from "../../logger";
import { ConfigError } from "../config-error";
import { json5Parse } from "../parsers/json5";

export const githubResolution = async (repoId: string) => {
  logger.verbose(`Resolving config from GitHub repo: ${repoId}`);

  const parts = repoId.split("/");
  const [owner, repoName] = parts;

  if (
    parts.length !== 2 ||
    owner === undefined ||
    repoName === undefined ||
    owner.length === 0 ||
    repoName.length === 0
  ) {
    throw new ConfigError(`Invalid GitHub repo ID: ${repoId}`);
  }

  try {
    const repo = new GitHubClient(owner, "", "license-cop").getReadonlyRepository(repoName);
    const fileContent = await repo.readFile(".licenses.json");

    return json5Parse(fileContent);
  } catch (e) {
    throw new ConfigError(
      `Could not resolve config from GitHub repo: ${repoId}, error: ${JSON.stringify(e)}`
    );
  }
};
