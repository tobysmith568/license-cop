export type PackageManager =
  | "npm"
  | "pnpm-10"
  | "pnpm-11"
  | "pnpm-12"
  | "yarn-1"
  | "yarn-3"
  | "yarn-4"
  | "bun-1-hoisted"
  | "bun-1-isolated";

export const packageManagers: PackageManager[] = [
  "npm",
  "pnpm-10",
  "pnpm-11",
  "pnpm-12",
  "yarn-1",
  "yarn-3",
  "yarn-4",
  "bun-1-hoisted",
  "bun-1-isolated"
];

export type PinnedPackageManager = Exclude<PackageManager, "npm">;
