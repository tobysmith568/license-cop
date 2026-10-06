export type PackageManager = (typeof packageManagers)[number];

export const packageManagers = [
  "npm-10",
  "npm-11",
  "npm-12",
  "pnpm-10",
  "pnpm-11",
  "pnpm-12",
  "yarn-1",
  "yarn-3",
  "yarn-3-pnp",
  "yarn-4",
  "yarn-4-pnp",
  "bun-1-hoisted",
  "bun-1-isolated"
] as const;
