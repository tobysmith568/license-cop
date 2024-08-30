export type PackageManager = "npm" | "yarn-classic" | "yarn-modern-with-node-modules" | "pnpm";

export interface TestOptions {
  packageManager: PackageManager;
  directory: string;
  args: string[];
  expectedExitCode: number;
}
