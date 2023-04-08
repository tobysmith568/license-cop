import axios from "axios";
import { json5Parse } from "../parsers/json5";

export const httpResolution = async (url: string) => {
  const response = await axios.get(url);

  if (typeof response.data === "string") {
    return await json5Parse(response.data);
  }

  return response.data;
};
