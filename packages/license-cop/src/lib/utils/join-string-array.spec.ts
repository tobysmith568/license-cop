import { joinStringArray } from "./join-string-array";

describe("joinStringArray", () => {
  it("should return an empty string if the array is empty", () => {
    const input: string[] = [];

    const result = joinStringArray(input);

    expect(result).toBe("");
  });

  it("should return the only element if the array has only one element", () => {
    const input: string[] = ["one"];

    const result = joinStringArray(input);

    expect(result).toBe("one");
  });

  it("should return the two elements separated by 'and' if the array has two elements", () => {
    const input: string[] = ["one", "two"];

    const result = joinStringArray(input);

    expect(result).toBe("one and two");
  });

  it("should return the three elements separated by commas and a penultimate 'and' if the array has three elements", () => {
    const input: string[] = ["one", "two", "three"];

    const result = joinStringArray(input);

    expect(result).toBe("one, two, and three");
  });

  it("should return the four elements separated by commas and a penultimate 'and' if the array has four elements", () => {
    const input: string[] = ["one", "two", "three", "four"];

    const result = joinStringArray(input);

    expect(result).toBe("one, two, three, and four");
  });
});
