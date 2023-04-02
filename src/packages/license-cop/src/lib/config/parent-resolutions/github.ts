import { GitHubClient } from "git-filesystem";
import JSON5 from "json5";

export const githubResolution = async (repoId: string) => {
  const parts = repoId.split("/");

  if (parts.length !== 2 || parts[0].length === 0 || parts[1].length === 0) {
    throw new Error(`Invalid GitHub repo ID: ${repoId}`);
  }

  const [owner, repoName] = parts;

  const repo = new GitHubClient(owner, "", "license-cop").getReadonlyRepository(repoName);
  const fileContent = await repo.readFile(".licenses.json");

  return JSON5.parse(fileContent);
};
