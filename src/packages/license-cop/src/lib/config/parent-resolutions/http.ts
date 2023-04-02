import axios from "axios";

export const httpResolution = async (url: string) => {
  const response = await axios.get(url);
  return response.data;
};
