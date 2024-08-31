import { satisfies } from "compare-versions";

export const isAllowedPackage = (
  packageName: string,
  packageVersion: string,
  allowedPackages: string[]
) => {
  for (const allowedPackage of allowedPackages) {
    if (allowedPackage === packageName) {
      return true;
    }

    if (allowedPackage.startsWith(packageName + "@")) {
      const allowedPackageVersion = allowedPackage.substring(packageName.length + 1);

      if (satisfies(packageVersion, allowedPackageVersion)) {
        return true;
      }
    }
  }

  return false;
};
