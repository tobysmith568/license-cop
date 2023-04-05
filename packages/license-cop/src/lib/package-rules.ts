export const isAllowedPackage = (
  packageName: string,
  packageVersion: string,
  allowedPackages: string[]
) => {
  if (allowedPackages.includes(packageName)) {
    return true;
  }

  const packageId = `${packageName}@${packageVersion}`;

  return allowedPackages.includes(packageId);
};

export const isAllowedLicense = (license: string, allowedLicenses: string[]) => {
  return allowedLicenses.includes(license);
};
