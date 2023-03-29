import { Stats } from "fs";
import { readFile, stat } from "fs/promises";

interface PackageJson {
  version?: string;
  license?: string;
}

export const readPackageJson = async (pathToPackageJson: string): Promise<PackageJson> => {
  const doesPackageJsonExist = await doesFileExist(pathToPackageJson);
  if (!doesPackageJsonExist) {
    throw new Error(`Cannot find the file: '${pathToPackageJson}'`);
  }

  const packageJsonAsString: string = await readFile(pathToPackageJson, { encoding: "utf8" });

  const packageJson: PackageJson = JSON.parse(packageJsonAsString);
  return packageJson;
};

const doesFileExist = async (path: string): Promise<boolean> => {
  try {
    const stats: Stats = await stat(path);
    return stats.isFile();
  } catch {
    return false;
  }
};
