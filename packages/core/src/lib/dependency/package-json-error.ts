export class PackageJsonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PackageJsonError";
  }
}
