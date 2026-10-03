/** How a package manager laid an install out on disk, i.e. which engine can walk it. */
export type InstallShape = "node-modules" | "pnpm-store" | "bun-isolated";
