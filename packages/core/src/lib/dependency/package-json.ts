import { Stats } from "fs";
import { readFile, stat } from "fs/promises";
import { z } from "zod";
import { json5Parse } from "../config/parsers/json5";
import { noopOnVerbose, type OnVerbose } from "../on-verbose";
import { PackageJsonError } from "./package-json-error";

const licenseSectionValidator = z.object({
  type: z.string(),
  url: z.string().optional()
});

const packageJsonValidator = z.object({
  name: z.string(),
  version: z.string(),
  license: z.union([z.string(), licenseSectionValidator]).optional(),
  licenses: licenseSectionValidator.array().optional(),
  packageManager: z.string().optional()
});

const packageManagerValidator = z.object({
  packageManager: z.string().optional()
});

export type PackageJson = z.infer<typeof packageJsonValidator>;

export const readPackageJson = async (
  pathToPackageJson: string,
  onVerbose: OnVerbose = noopOnVerbose
): Promise<PackageJson> => {
  const parsedFile = await readJsonFile(pathToPackageJson, onVerbose);

  const packageJson = packageJsonValidator.safeParse(parsedFile);

  if (!packageJson.success) {
    throw new PackageJsonError(
      `Unable to parse package.json: ${pathToPackageJson}: ${packageJson.error.message}`
    );
  }

  return packageJson.data;
};

/**
 * Unlike `readPackageJson`, this doesn't require the package.json to have a name or version,
 * which the package.json of a workspace root often doesn't.
 */
export const readPackageManagerField = async (
  pathToPackageJson: string,
  onVerbose: OnVerbose = noopOnVerbose
): Promise<string | undefined> => {
  const parsedFile = await readJsonFile(pathToPackageJson, onVerbose);

  const packageJson = packageManagerValidator.safeParse(parsedFile);

  if (!packageJson.success) {
    throw new PackageJsonError(
      `Unable to parse package.json: ${pathToPackageJson}: ${packageJson.error.message}`
    );
  }

  return packageJson.data.packageManager;
};

export const getLicenseExpression = (packageJson: PackageJson): string => {
  if (packageJson.license && typeof packageJson.license === "string") {
    return packageJson.license;
  }

  if (packageJson.license && typeof packageJson.license === "object") {
    return packageJson.license.type;
  }

  if (packageJson.licenses && packageJson.licenses.length > 0) {
    const licenses = packageJson.licenses.map<string>(license => license.type);

    if (licenses.length === 1) {
      return licenses[0]!;
    }

    return `(${licenses.join(" AND ")})`;
  }

  return "UNLICENSED";
};

const readJsonFile = async (path: string, onVerbose: OnVerbose): Promise<unknown> => {
  const doesPackageJsonExist = await doesFileExist(path);
  if (!doesPackageJsonExist) {
    onVerbose(`Cannot find the package.json: '${path}'`);
    throw new PackageJsonError(`Cannot find the file: '${path}'`);
  }

  const contents: string = await readFile(path, { encoding: "utf8" });

  try {
    return json5Parse<unknown>(contents);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new PackageJsonError(`Unable to parse package.json: ${path}: ${reason}`);
  }
};

const doesFileExist = async (path: string): Promise<boolean> => {
  try {
    const stats: Stats = await stat(path);
    return stats.isFile();
  } catch {
    return false;
  }
};
