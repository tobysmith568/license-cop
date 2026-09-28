import { beforeEach, describe, expect, it, mock } from "bun:test";

const fetchMock = mock();
globalThis.fetch = fetchMock as unknown as typeof fetch;

const { httpResolution } = await import("./http");

const noop = () => {};

const okResponse = (data: string) => ({
  ok: true,
  status: 200,
  text: () => Promise.resolve(data),
});

describe("httpResolution", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("should request the given url", async () => {
    fetchMock.mockResolvedValue(okResponse("{}"));

    await httpResolution("https://example.com/config.json", noop);

    expect(fetchMock).toHaveBeenCalledWith("https://example.com/config.json");
  });

  it("should return an already-parsed response as-is", async () => {
    fetchMock.mockResolvedValue(okResponse('{ "licenses": ["MIT"] }'));

    const result = await httpResolution("https://example.com/config.json", noop);

    expect(result).toEqual({ licenses: ["MIT"] });
  });

  it("should parse a string response as JSON5", async () => {
    fetchMock.mockResolvedValue(okResponse("{ licenses: ['MIT'], // comment\n }"));

    const result = await httpResolution("https://example.com/.licenses.json5", noop);

    expect(result).toEqual({ licenses: ["MIT"] });
  });

  it("should throw when a string response isn't valid", async () => {
    fetchMock.mockResolvedValue(okResponse("<html>not a config</html>"));

    const act = httpResolution("https://example.com/config", noop);

    await expect(act).rejects.toThrow();
  });

  it("should report what it's resolving", async () => {
    fetchMock.mockResolvedValue(okResponse("{}"));
    const messages: string[] = [];

    await httpResolution("https://example.com/config.json", message => messages.push(message));

    expect(messages).toEqual(["Resolving http config: https://example.com/config.json"]);
  });

  it("should propagate request failures", async () => {
    fetchMock.mockRejectedValue(new Error("Network Error"));

    const act = httpResolution("https://example.com/config.json", noop);

    await expect(act).rejects.toThrow("Network Error");
  });

  it("should throw when the response status is not ok", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, text: () => Promise.resolve("") });

    const act = httpResolution("https://example.com/config.json", noop);

    await expect(act).rejects.toThrow("404");
  });
});
