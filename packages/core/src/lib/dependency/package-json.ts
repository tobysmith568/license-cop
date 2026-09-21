import { readFile } from "fs/promises";
import { z } from "zod";
import { json5Parse } from "../config/parsers/json5";
import { noopOnVerbose, type OnVerbose } from "../on-verbose";
import { fileExists } from "../utils/file-exists";
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

const declaredDependenciesValidator = z.object({
  dependencies: z.record(z.string(), z.string()).optional(),
  devDependencies: z.record(z.string(), z.string()).optional(),
  optionalDependencies: z.record(z.string(), z.string()).optional()
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

export type DeclaredDependencies = {
  dependencies: string[];
  devDependencies: string[];
  optionalDependencies: string[];
};

/**
 * The names of the dependencies a package.json asks for, as opposed to `readPackageJson`, which is
 * about the package itself. Like `readPackageManagerField`, it doesn't need a name or version.
 */
export const readDeclaredDependencies = async (
  pathToPackageJson: string,
  onVerbose: OnVerbose = noopOnVerbose
): Promise<DeclaredDependencies> => {
  const parsedFile = await readJsonFile(pathToPackageJson, onVerbose);

  const packageJson = declaredDependenciesValidator.safeParse(parsedFile);

  if (!packageJson.success) {
    throw new PackageJsonError(
      `Unable to parse package.json: ${pathToPackageJson}: ${packageJson.error.message}`
    );
  }

  return {
    dependencies: Object.keys(packageJson.data.dependencies ?? {}),
    devDependencies: Object.keys(packageJson.data.devDependencies ?? {}),
    optionalDependencies: Object.keys(packageJson.data.optionalDependencies ?? {})
  };
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
  const doesPackageJsonExist = await fileExists(path);
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
