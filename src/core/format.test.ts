import { describe, expect, it } from "vitest";
import { formatExperience } from "./format";

describe("formatExperience", () => {
  it("21 год 10 месяцев", () => {
    expect(formatExperience(262)).toBe("21 год 10 месяцев");
  });

  it("21 год 9 месяцев", () => {
    expect(formatExperience(261)).toBe("21 год 9 месяцев");
  });

  it("1 год 0 месяцев", () => {
    expect(formatExperience(12)).toBe("1 год 0 месяцев");
  });

  it("0 лет 5 месяцев", () => {
    expect(formatExperience(5)).toBe("0 лет 5 месяцев");
  });

  it("2 года 3 месяца", () => {
    expect(formatExperience(27)).toBe("2 года 3 месяца");
  });
});
