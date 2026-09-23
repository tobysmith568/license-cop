import { beforeEach, describe, expect, it, mock } from "bun:test";

const get = mock();
void mock.module("axios", () => ({ default: { get } }));

const { httpResolution } = await import("./http");

const noop = () => {};

describe("httpResolution", () => {
  beforeEach(() => {
    get.mockReset();
  });

  it("should request the given url", async () => {
    get.mockResolvedValue({ data: {} });

    await httpResolution("https://example.com/config.json", noop);

    expect(get).toHaveBeenCalledWith("https://example.com/config.json");
  });

  it("should return an already-parsed response as-is", async () => {
    get.mockResolvedValue({ data: { licenses: ["MIT"] } });

    const result = await httpResolution("https://example.com/config.json", noop);

    expect(result).toEqual({ licenses: ["MIT"] });
  });

  it("should parse a string response as JSON5", async () => {
    get.mockResolvedValue({ data: "{ licenses: ['MIT'], // comment\n }" });

    const result = await httpResolution("https://example.com/.licenses.json5", noop);

    expect(result).toEqual({ licenses: ["MIT"] });
  });

  it("should throw when a string response isn't valid", async () => {
    get.mockResolvedValue({ data: "<html>not a config</html>" });

    const act = httpResolution("https://example.com/config", noop);

    await expect(act).rejects.toThrow();
  });

  it("should report what it's resolving", async () => {
    get.mockResolvedValue({ data: {} });
    const messages: string[] = [];

    await httpResolution("https://example.com/config.json", message => messages.push(message));

    expect(messages).toEqual(["Resolving http config: https://example.com/config.json"]);
  });

  it("should propagate request failures", async () => {
    get.mockRejectedValue(new Error("Network Error"));

    const act = httpResolution("https://example.com/config.json", noop);

    await expect(act).rejects.toThrow("Network Error");
  });
});
