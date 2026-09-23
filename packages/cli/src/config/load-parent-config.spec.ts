import { beforeEach, describe, expect, it, mock } from "bun:test";
import { ConfigError } from "./config-error";

const npmResolution = mock();
const nodeModuleExists = mock();
const githubResolution = mock();
const httpResolution = mock();

void mock.module("./parent-resolutions/npm", () => ({ npmResolution, nodeModuleExists }));
void mock.module("./parent-resolutions/github", () => ({ githubResolution }));
void mock.module("./parent-resolutions/http", () => ({ httpResolution }));

const { loadParentConfig } = await import("./load-parent-config");

describe("loadParentConfig", () => {
  const noop = () => {};

  beforeEach(() => {
    npmResolution.mockReset().mockResolvedValue("npm result");
    nodeModuleExists.mockReset().mockResolvedValue(false);
    githubResolution.mockReset().mockResolvedValue("github result");
    httpResolution.mockReset().mockResolvedValue("http result");
  });

  it("should resolve an npm: prefix from npm without the prefix", async () => {
    const result = await loadParentConfig("npm:@scope/config", "/root", noop);

    expect(result).toBe("npm result");
    expect(npmResolution).toHaveBeenCalledWith("@scope/config", "/root", noop);
  });

  it("should resolve a github: prefix from GitHub without the prefix", async () => {
    const result = await loadParentConfig("github:owner/repo", "/root", noop);

    expect(result).toBe("github result");
    expect(githubResolution).toHaveBeenCalledWith("owner/repo", noop);
  });

  it.each([["http://example.com/config"], ["https://example.com/config"]])(
    "should resolve %s over http",
    async url => {
      const result = await loadParentConfig(url, "/root", noop);

      expect(result).toBe("http result");
      expect(httpResolution).toHaveBeenCalledWith(url, noop);
    }
  );

  it("should resolve an unprefixed name from npm when it's an installed module", async () => {
    nodeModuleExists.mockResolvedValue(true);

    const result = await loadParentConfig("some-config", "/root", noop);

    expect(result).toBe("npm result");
    expect(nodeModuleExists).toHaveBeenCalledWith("some-config", "/root");
    expect(npmResolution).toHaveBeenCalledWith("some-config", "/root", noop);
  });

  it("should throw a ConfigError for an unprefixed name that isn't an installed module", async () => {
    const act = loadParentConfig("some-config", "/root", noop);

    await expect(act).rejects.toThrow(ConfigError);
    await expect(act).rejects.toThrow("Invalid parent config location: some-config");
  });
});
