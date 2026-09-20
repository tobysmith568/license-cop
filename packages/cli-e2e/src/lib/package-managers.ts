export type PnpmPackageManager = "pnpm-10" | "pnpm-11" | "pnpm-12";

export type PackageManager =
  "npm" | PnpmPackageManager | "yarn-1" | "yarn-3-with-node-modules" | "yarn-4-with-node-modules";

export const packageManagers: PackageManager[] = [
  "npm",
  "pnpm-10",
  "pnpm-11",
  "pnpm-12",
  "yarn-1",
  "yarn-3-with-node-modules",
  "yarn-4-with-node-modules"
];
