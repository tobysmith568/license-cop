import { z } from "zod";
import { JsonFileReader } from "./json-file-reader";
import { PackageJson, packageJsonSchema } from "./package-json";
import { PackageJsonError } from "./package-json-error";

const packageManagerSchema = z.object({
  packageManager: z.string().optional()
});

const declaredDependenciesSchema = z.object({
  dependencies: z.record(z.string(), z.string()).optional(),
  devDependencies: z.record(z.string(), z.string()).optional(),
  optionalDependencies: z.record(z.string(), z.string()).optional()
});

export type DeclaredDependencies = {
  dependencies: string[];
  devDependencies: string[];
  optionalDependencies: string[];
};

export interface PackageJsonReader {
  /** The package itself: what it is called and under what license it is published. */
  read(pathToPackageJson: string): Promise<PackageJson>;

  /**
   * Unlike `read`, this doesn't require the package.json to have a name or version, which the
   * package.json of a workspace root often doesn't.
   */
  readPackageManagerField(pathToPackageJson: string): Promise<string | undefined>;

  /**
   * The names of the dependencies a package.json asks for, as opposed to `read`, which is about the
   * package itself. Like `readPackageManagerField`, it doesn't need a name or version.
   */
  readDeclaredDependencies(pathToPackageJson: string): Promise<DeclaredDependencies>;
}

export class FilePackageJsonReader extends JsonFileReader implements PackageJsonReader {
  protected readonly description = "package.json";

  async read(pathToPackageJson: string): Promise<PackageJson> {
    const raw = await this.readJson(pathToPackageJson);
    const data = this.validate(packageJsonSchema, raw, pathToPackageJson);

    return new PackageJson(data);
  }

  async readPackageManagerField(pathToPackageJson: string): Promise<string | undefined> {
    const raw = await this.readJson(pathToPackageJson);
    const data = this.validate(packageManagerSchema, raw, pathToPackageJson);

    return data.packageManager;
  }

  async readDeclaredDependencies(pathToPackageJson: string): Promise<DeclaredDependencies> {
    const raw = await this.readJson(pathToPackageJson);
    const data = this.validate(declaredDependenciesSchema, raw, pathToPackageJson);

    return {
      dependencies: Object.keys(data.dependencies ?? {}),
      devDependencies: Object.keys(data.devDependencies ?? {}),
      optionalDependencies: Object.keys(data.optionalDependencies ?? {})
    };
  }

  protected createError(message: string): Error {
    return new PackageJsonError(message);
  }
}
