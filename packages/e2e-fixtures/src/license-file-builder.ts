export class LicenseFileBuilder {
  private licenses: string[] = [];
  private packages: string[] = [];

  allowingLicenses(...licenses: string[]): this {
    this.licenses.push(...licenses);
    return this;
  }

  allowingPackages(...packages: string[]): this {
    this.packages.push(...packages);
    return this;
  }

  build(): object {
    return { licenses: this.licenses, packages: this.packages };
  }
}
