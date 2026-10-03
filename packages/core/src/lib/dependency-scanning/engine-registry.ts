import type { InstallShape } from "../install-shape";
import type { DependencyScanningEngine } from "./dependency-scanning-engine";

export type RegisteredEngines = {
  nodeModules: DependencyScanningEngine;
  pnpmStore: DependencyScanningEngine;
  bunIsolated: DependencyScanningEngine;
};

/** Picks the engine that can walk an install shape. */
export class EngineRegistry {
  // Typed as a `Record` so that adding a shape to `InstallShape` stops compiling until it's mapped here
  private readonly engines: Record<InstallShape, DependencyScanningEngine>;

  constructor({ nodeModules, pnpmStore, bunIsolated }: RegisteredEngines) {
    this.engines = {
      "node-modules": nodeModules,
      "pnpm-store": pnpmStore,
      "bun-isolated": bunIsolated
    };
  }

  get(shape: InstallShape): DependencyScanningEngine {
    return this.engines[shape];
  }
}
