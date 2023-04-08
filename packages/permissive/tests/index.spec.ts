import JSON5 from "json5";
import { readFile } from "fs/promises";
import { join } from "path";

const filePath = join(__dirname, "../", ".licenses.jsonc");

describe(".licenses.jsonc", () => {
  it("should be valid json5", async () => {
    const fileContent = await readFile(filePath, "utf-8");

    expect(fileContent).toBeTruthy();
    expect(() => JSON5.parse(fileContent)).not.toThrow();
  });

  it("should contain a licenses array", async () => {
    const fileContent = await readFile(filePath, "utf-8");

    const parsedContent = JSON5.parse(fileContent);

    expect(parsedContent).toHaveProperty("licenses");
    expect(parsedContent.licenses).toBeInstanceOf(Array);
    expect(parsedContent.licenses.length).toBeGreaterThan(0);
  });
});
