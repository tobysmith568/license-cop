import { z } from "zod";

const licenseSectionSchema = z.object({
  type: z.string(),
  url: z.string().optional()
});

// Old packages declare `licenses` in more than one shape: the array of { type, url } objects, but
// also a bare string ("MIT") or a single object. One odd manifest must not fail the whole scan.
const legacyLicenseSchema = z.union([z.string(), licenseSectionSchema]);

export const packageJsonSchema = z.object({
  name: z.string(),
  version: z.string(),
  license: z.union([z.string(), licenseSectionSchema]).optional(),
  licenses: z.union([legacyLicenseSchema, legacyLicenseSchema.array()]).optional(),
  packageManager: z.string().optional()
});

export type PackageJsonData = z.infer<typeof packageJsonSchema>;

/** A package's own package.json: what it is called and under what license it is published. */
export class PackageJson {
  constructor(private readonly data: PackageJsonData) {}

  get name(): string {
    return this.data.name;
  }

  get version(): string {
    return this.data.version;
  }

  /** The SPDX expression of the package's license, or `UNLICENSED` when it declares none. */
  get licenseExpression(): string {
    const { license, licenses } = this.data;

    if (license && typeof license === "string") {
      return license;
    }

    if (license && typeof license === "object") {
      return license.type;
    }

    const types = toLicenseTypes(licenses);

    if (types.length === 1) {
      return types[0]!;
    }

    if (types.length > 1) {
      return `(${types.join(" AND ")})`;
    }

    return "UNLICENSED";
  }
}

const toLicenseTypes = (licenses: PackageJsonData["licenses"]): string[] => {
  if (licenses === undefined) {
    return [];
  }

  const entries = Array.isArray(licenses) ? licenses : [licenses];
  const types = entries.map(entry => (typeof entry === "string" ? entry : entry.type));

  return types.filter(type => type !== "");
};
