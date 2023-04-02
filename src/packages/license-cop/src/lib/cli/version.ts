import { join } from "path";
import { readPackageJson } from "../package-json";

export const printPackageVersion = async (): Promise<void> => {
  const packageJsonLocation = join(__dirname, "../../../package.json");
  const { version } = await readPackageJson(packageJsonLocation);
  console.log(`v${version}`);
};
