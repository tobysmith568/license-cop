import { Spec } from "arg";

export interface UserInputs {
  version?: boolean;
}

export interface ArgumentsWithAliases extends Spec {
  "--directory": typeof String;
  "--dir": "--directory";
  "-d": "--directory";

  "--include-dev-dependencies": typeof Boolean;
  "--dev": "--include-dev-dependencies";
  "-D": "--include-dev-dependencies";

  "--version": typeof Boolean;
  "-v": "--version";
}

export const argumentsWithAliases: ArgumentsWithAliases = {
  "--directory": String,
  "--dir": "--directory",
  "-d": "--directory",

  "--include-dev-dependencies": Boolean,
  "--dev": "--include-dev-dependencies",
  "-D": "--include-dev-dependencies",

  "--version": Boolean,
  "-v": "--version"
};
