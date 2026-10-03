import type { PackageJson } from "../dependency/package-json";

/**
 * A dependency in a package manager-agnostic shape. Each engine is responsible for walking its own
 * native tree (including any dev-dependency filtering) and producing these.
 */
export interface NormalizedNode {
  /** Identifies the node within a scan, e.g. `name@version`. Used to de-duplicate results. */
  id: string;
  /** The name checked against the allowed packages list. */
  name: string;
  packageJson: PackageJson;
  children: NormalizedNode[];
}
