import { describe, expect, it } from "vitest";
import { extractDateRange } from "./parse-dates";

describe("extractDateRange()", () => {
  it("2003-10 - 2005-07 -> start/end", () => {
    expect(extractDateRange("работал 2003-10 - 2005-07")).toEqual({
      start: "2003-10",
      end: "2005-07",
      isCurrent: false,
    });
  });

  it("октябрь 2003 - июль 2005 -> start/end", () => {
    expect(extractDateRange("работал октябрь 2003 - июль 2005")).toEqual({
      start: "2003-10",
      end: "2005-07",
      isCurrent: false,
    });
  });

  it("10.2003 - 07.2005 -> start/end", () => {
    expect(extractDateRange("работал 10.2003 - 07.2005")).toEqual({
      start: "2003-10",
      end: "2005-07",
      isCurrent: false,
    });
  });

  it("с 2019 по настоящее время -> isCurrent", () => {
    expect(extractDateRange("работаю с 2019 по настоящее время")).toEqual({
      start: "2019-01",
      end: null,
      isCurrent: true,
    });
  });

  it("пустая строка -> null", () => {
    expect(extractDateRange("")).toEqual({ start: null, end: null, isCurrent: false });
  });
});
