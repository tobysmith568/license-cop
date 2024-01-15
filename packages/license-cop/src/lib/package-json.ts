import { Stats } from "fs";
import { readFile, stat } from "fs/promises";
import { z } from "zod";
import { json5Parse } from "./config/parsers/json5";
import logger from "./logger";

const licenseSectionValidator = z.object({
  type: z.string(),
  url: z.string().optional()
});

const packageJsonValidator = z.object({
  name: z.string(),
  version: z.string(),
  license: z.union([z.string(), licenseSectionValidator]).optional(),
  licenses: licenseSectionValidator.array().optional()
});

type PackageJson = z.infer<typeof packageJsonValidator>;

export const readPackageJson = async (pathToPackageJson: string): Promise<PackageJson> => {
  const doesPackageJsonExist = await doesFileExist(pathToPackageJson);
  if (!doesPackageJsonExist) {
    logger.verbose(`Cannot find the package.json: '${pathToPackageJson}'`);
    throw new Error(`Cannot find the file: '${pathToPackageJson}'`);
  }

  const packageJsonAsString: string = await readFile(pathToPackageJson, { encoding: "utf8" });

  const parsedFile = json5Parse<unknown>(packageJsonAsString);

  const packageJson = packageJsonValidator.safeParse(parsedFile);

  if (!packageJson.success) {
    throw new Error(
      `Unable to parse package.json: ${pathToPackageJson}: ${packageJson.error.message}`
    );
  }

  return packageJson.data;
};

export const getLicenseExpression = (packageJson: PackageJson): string => {
  if (packageJson.license && typeof packageJson.license === "string") {
    return packageJson.license;
  }

  if (packageJson.license && typeof packageJson.license === "object") {
    return packageJson.license.type;
  }

  if (packageJson.licenses) {
    const licenses = packageJson.licenses.map<string>(license => license.type);

    if (licenses.length === 1) {
      return licenses[0];
    }

    return `(${licenses.join(" AND ")})`;
  }

  return "UNLICENSED";
};

const doesFileExist = async (path: string): Promise<boolean> => {
  try {
    const stats: Stats = await stat(path);
    return stats.isFile();
  } catch {
    return false;
  }
};
