import axios from "axios";
import { noopOnVerbose, type OnVerbose } from "../../on-verbose";
import { json5Parse } from "../parsers/json5";

export const httpResolution = async (url: string, onVerbose: OnVerbose = noopOnVerbose) => {
  onVerbose(`Resolving http config: ${url}`);

  const response = await axios.get(url);

  if (typeof response.data === "string") {
    return await json5Parse(response.data);
  }

  return response.data;
};
