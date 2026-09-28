import type { OnVerbose } from "@license-cop/core";
import { ConfigError } from "../config-error";
import { json5Parse } from "../parsers/json5";

export const githubResolution = async (repoId: string, onVerbose: OnVerbose) => {
  onVerbose(`Resolving config from GitHub repo: ${repoId}`);

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
    const url = `https://api.github.com/repos/${owner}/${repoName}/contents/.licenses.json`;
    const response = await fetch(url, {
      headers: {
        accept: "application/vnd.github.raw+json",
        "user-agent": "license-cop"
      }
    });

    if (!response.ok) {
      throw new Error(`Request failed with status code ${response.status}`);
    }

    const fileContent = await response.text();

    return json5Parse(fileContent);
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    throw new ConfigError(`Could not resolve config from GitHub repo: ${repoId}, error: ${reason}`);
  }
};
