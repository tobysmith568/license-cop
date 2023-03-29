import { Spec } from "arg";

export interface UserInputs {
  version?: boolean;
}

export interface ArgumentsWithAliases extends Spec {
  "--directory": typeof String;
  "--dir": "--directory";
  "-d": "--directory";
  "--version": typeof Boolean;
  "-v": "--version";
}

export const argumentsWithAliases: ArgumentsWithAliases = {
  "--directory": String,
  "--dir": "--directory",
  "-d": "--directory",
  "--version": Boolean,
  "-v": "--version"
};
