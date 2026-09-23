export type PackageManager =
  "npm" | "pnpm-10" | "pnpm-11" | "pnpm-12" | "yarn-1" | "yarn-3" | "yarn-4";

export const packageManagers: PackageManager[] = [
  "npm",
  "pnpm-10",
  "pnpm-11",
  "pnpm-12",
  "yarn-1",
  "yarn-3",
  "yarn-4"
];

export type PinnedPackageManager = Exclude<PackageManager, "npm">;
