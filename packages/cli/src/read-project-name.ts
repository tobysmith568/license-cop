import { PackageJsonError, type OnVerbose } from "@license-cop/core";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { json5Parse } from "./config/parsers/json5";

const projectPackageJsonSchema = z.object({ name: z.string() });

/** The name in a project's package.json, for saying what's being scanned. */
export const readProjectName = async (
  pathToPackageJson: string,
  onVerbose: OnVerbose
): Promise<string> => {
  const contents = await readFile(pathToPackageJson, "utf8").catch(() => {
    onVerbose(`Cannot find the package.json: '${pathToPackageJson}'`);
    throw new PackageJsonError(`Cannot find the file: '${pathToPackageJson}'`);
  });

  let parsed: unknown;

  try {
    parsed = json5Parse<unknown>(contents);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new PackageJsonError(`Unable to parse package.json: ${pathToPackageJson}: ${reason}`);
  }

  const result = projectPackageJsonSchema.safeParse(parsed);

  if (!result.success) {
    throw new PackageJsonError(
      `Unable to parse package.json: ${pathToPackageJson}: ${result.error.message}`
    );
  }

  return result.data.name;
};
