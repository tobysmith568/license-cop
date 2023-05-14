export const joinStringArray = (array: string[]): string => {
  let result = "";

  for (let i = 0; i < array.length; i++) {
    result += array[i];

    const isPenultimateElement = i === array.length - 2;
    const isLastElement = i === array.length - 1;

    if (isPenultimateElement) {
      if (array.length === 2) {
        result += " and ";
      } else {
        result += ", and ";
      }
    }

    if (!isLastElement && !isPenultimateElement) {
      result += ", ";
    }
  }

  return result;
};
