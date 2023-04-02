import { Spec } from "arg";

export interface UserInputs {
  version?: boolean;
}

export interface ArgumentsWithAliases extends Spec {
  "--init": typeof Boolean;

  "--directory": typeof String;
  "--dir": "--directory";
  "-d": "--directory";

  "--include-dev-dependencies": typeof Boolean;
  "--dev": "--include-dev-dependencies";
  "-D": "--include-dev-dependencies";

  "--dev-dependencies-only": typeof Boolean;
  "--dev-only": "--dev-dependencies-only";

  "--version": typeof Boolean;
  "-v": "--version";
}

export const argumentsWithAliases: ArgumentsWithAliases = {
  "--init": Boolean,

  "--directory": String,
  "--dir": "--directory",
  "-d": "--directory",

  "--include-dev-dependencies": Boolean,
  "--dev": "--include-dev-dependencies",
  "-D": "--include-dev-dependencies",

  "--dev-dependencies-only": Boolean,
  "--dev-only": "--dev-dependencies-only",

  "--version": Boolean,
  "-v": "--version"
};
