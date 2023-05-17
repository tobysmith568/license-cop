import { getTokens } from "./get-tokens";
import { parseTokens } from "./parse-tokens";
import { SpdxExpression, Unlicensed } from "./types/spdx-expression";

export const parseLicenseExpression = (input: string): SpdxExpression | Unlicensed => {
  if (input === "UNLICENSED") {
    return {
      type: "unlicensed"
    };
  }

  const tokens = getTokens(input);
  return parseTokens(tokens, input);
};
