import { beforeEach, describe, expect, it, mock } from "bun:test";
import { ConfigError } from "../config-error";

const readFile = mock();
const getReadonlyRepository = mock(() => ({ readFile }));
const gitHubClient = mock((_owner: string, _token: string, _userAgent: string) => ({
  getReadonlyRepository
}));

class FakeGitHubClient {
  constructor(owner: string, token: string, userAgent: string) {
    return gitHubClient(owner, token, userAgent);
  }
}

void mock.module("git-filesystem", () => ({ GitHubClient: FakeGitHubClient }));

const { githubResolution } = await import("./github");

describe("githubResolution", () => {
  beforeEach(() => {
    readFile.mockReset();
    getReadonlyRepository.mockClear();
    gitHubClient.mockClear();
  });

  it("should read .licenses.json from the given repo", async () => {
    readFile.mockResolvedValue(`{ "licenses": ["MIT"] }`);

    const result = await githubResolution("owner/repo");

    expect(result).toEqual({ licenses: ["MIT"] });
    expect(gitHubClient).toHaveBeenCalledWith("owner", "", "license-cop");
    expect(getReadonlyRepository).toHaveBeenCalledWith("repo");
    expect(readFile).toHaveBeenCalledWith(".licenses.json");
  });

  it("should parse the file as JSON5", async () => {
    readFile.mockResolvedValue("{ licenses: ['MIT'], // comment\n }");

    const result = await githubResolution("owner/repo");

    expect(result).toEqual({ licenses: ["MIT"] });
  });

  it("should report what it's resolving", async () => {
    readFile.mockResolvedValue("{}");
    const messages: string[] = [];

    await githubResolution("owner/repo", message => messages.push(message));

    expect(messages).toEqual(["Resolving config from GitHub repo: owner/repo"]);
  });

  it.each([[""], ["owner"], ["owner/"], ["/repo"], ["a/b/c"]])(
    "should throw a ConfigError for the invalid repo ID '%s'",
    async repoId => {
      const act = githubResolution(repoId);

      await expect(act).rejects.toThrow(ConfigError);
      await expect(act).rejects.toThrow(`Invalid GitHub repo ID: ${repoId}`);
    }
  );

  it("should throw a ConfigError, including the underlying message, when the file can't be read", async () => {
    readFile.mockRejectedValue(new Error("Not Found"));

    const act = githubResolution("owner/repo");

    await expect(act).rejects.toThrow(ConfigError);
    await expect(act).rejects.toThrow("Could not resolve config from GitHub repo: owner/repo");
    await expect(act).rejects.toThrow("error: Not Found");
  });

  it("should throw a ConfigError when the file isn't valid", async () => {
    readFile.mockResolvedValue("not a config");

    const act = githubResolution("owner/repo");

    await expect(act).rejects.toThrow(ConfigError);
  });
});
