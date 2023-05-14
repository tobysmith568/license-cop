import { Stats } from "fs";
import { readFile, stat } from "fs/promises";
import { z } from "zod";
import { json5Parse } from "./config/parsers/json5";
import logger from "./logger";
import { Violation } from "./violations-error";

const packageJsonValidator = z.object({
  name: z.string(),
  version: z.string(),
  license: z.string().optional(),
  licenses: z
    .object({
      type: z.string(),
      url: z.string().optional()
    })
    .array()
    .optional()
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

export const getLicenseExpression = (packageJson: PackageJson): string | Violation => {
  if (packageJson.license) {
    // TODO: check for AND/OR expressions
    return packageJson.license;
  }

  if (!packageJson.licenses?.length) {
    return {
      type: "no-license",
      packageName: packageJson.name,
      packageVersion: packageJson.version
    };
  }

  if (packageJson.licenses.length === 1) {
    return packageJson.licenses[0].type;
  }

  return {
    type: "multiple-licenses",
    packageName: packageJson.name,
    packageVersion: packageJson.version,
    licenses: packageJson.licenses.map(license => license.type)
  };
};

const doesFileExist = async (path: string): Promise<boolean> => {
  try {
    const stats: Stats = await stat(path);
    return stats.isFile();
  } catch {
    return false;
  }
};
