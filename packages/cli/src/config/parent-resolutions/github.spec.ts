import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { ConfigError } from "../config-error";

const originalFetch = globalThis.fetch;
const fetchMock = mock();
globalThis.fetch = fetchMock as unknown as typeof fetch;

afterAll(() => {
  globalThis.fetch = originalFetch;
});

const { githubResolution } = await import("./github");

const noop = () => {};

const okResponse = (data: string) => ({
  ok: true,
  status: 200,
  text: () => Promise.resolve(data),
});

describe("githubResolution", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("should read .licenses.json from the given repo", async () => {
    fetchMock.mockResolvedValue(okResponse(`{ "licenses": ["MIT"] }`));

    const result = await githubResolution("owner/repo", noop);

    expect(result).toEqual({ licenses: ["MIT"] });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/repos/owner/repo/contents/.licenses.json",
      {
        headers: {
          accept: "application/vnd.github.raw+json",
          "user-agent": "license-cop",
        },
      }
    );
  });

  it("should parse the file as JSON5", async () => {
    fetchMock.mockResolvedValue(okResponse("{ licenses: ['MIT'], // comment\n }"));

    const result = await githubResolution("owner/repo", noop);

    expect(result).toEqual({ licenses: ["MIT"] });
  });

  it("should report what it's resolving", async () => {
    fetchMock.mockResolvedValue(okResponse("{}"));
    const messages: string[] = [];

    await githubResolution("owner/repo", message => messages.push(message));

    expect(messages).toEqual(["Resolving config from GitHub repo: owner/repo"]);
  });

  it.each([[""], ["owner"], ["owner/"], ["/repo"], ["a/b/c"]])(
    "should throw a ConfigError for the invalid repo ID '%s'",
    async repoId => {
      const act = githubResolution(repoId, noop);

      await expect(act).rejects.toThrow(ConfigError);
      await expect(act).rejects.toThrow(`Invalid GitHub repo ID: ${repoId}`);
    }
  );

  it("should throw a ConfigError, including the underlying message, when the file can't be read", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, text: () => Promise.resolve("") });

    const act = githubResolution("owner/repo", noop);

    await expect(act).rejects.toThrow(ConfigError);
    await expect(act).rejects.toThrow("Could not resolve config from GitHub repo: owner/repo");
    await expect(act).rejects.toThrow("error: Request failed with status code 404");
  });

  it("should throw a ConfigError when the file isn't valid", async () => {
    fetchMock.mockResolvedValue(okResponse("not a config"));

    const act = githubResolution("owner/repo", noop);

    await expect(act).rejects.toThrow(ConfigError);
  });
});
