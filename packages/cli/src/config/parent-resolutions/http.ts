import type { OnVerbose } from "@license-cop/core";
import { json5Parse } from "../parsers/json5";

export const httpResolution = async (url: string, onVerbose: OnVerbose) => {
  onVerbose(`Resolving http config: ${url}`);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Request failed with status code ${response.status}`);
  }

  const body = await response.text();

  return json5Parse(body);
};
