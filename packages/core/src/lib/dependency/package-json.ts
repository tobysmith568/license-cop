import { z } from "zod";

const licenseSectionSchema = z.object({
  type: z.string(),
  url: z.string().optional()
});

export const packageJsonSchema = z.object({
  name: z.string(),
  version: z.string(),
  license: z.union([z.string(), licenseSectionSchema]).optional(),
  licenses: licenseSectionSchema.array().optional(),
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

    if (licenses && licenses.length > 0) {
      const types = licenses.map<string>(section => section.type);

      if (types.length === 1) {
        return types[0]!;
      }

      return `(${types.join(" AND ")})`;
    }

    return "UNLICENSED";
  }
}
