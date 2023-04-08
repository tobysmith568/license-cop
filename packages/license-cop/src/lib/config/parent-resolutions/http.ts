import axios from "axios";
import logger from "../../logger";
import { json5Parse } from "../parsers/json5";

export const httpResolution = async (url: string) => {
  logger.verbose(`Resolving http config: ${url}`);

  const response = await axios.get(url);

  if (typeof response.data === "string") {
    return await json5Parse(response.data);
  }

  return response.data;
};
