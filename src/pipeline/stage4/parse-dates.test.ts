import { describe, expect, it } from "vitest";
import { extractDateRange } from "./parse-dates";

describe("extractDateRange()", () => {
  it("2003-10 - 2005-07 -> start/end, confidence high", () => {
    expect(extractDateRange("работал 2003-10 - 2005-07")).toEqual({
      start: "2003-10",
      end: "2005-07",
      year: null,
      confidence: "high",
      isCurrent: false,
    });
  });

  it("октябрь 2003 - июль 2005 -> start/end, confidence high", () => {
    expect(extractDateRange("работал октябрь 2003 - июль 2005")).toEqual({
      start: "2003-10",
      end: "2005-07",
      year: null,
      confidence: "high",
      isCurrent: false,
    });
  });

  it("10.2003 - 07.2005 -> start/end, confidence high", () => {
    expect(extractDateRange("работал 10.2003 - 07.2005")).toEqual({
      start: "2003-10",
      end: "2005-07",
      year: null,
      confidence: "high",
      isCurrent: false,
    });
  });

  it("голый год не становится датой: Привлёк 2000 клиентов -> start/end null, confidence low", () => {
    expect(extractDateRange("Привлёк 2000 клиентов за год")).toEqual({
      start: null,
      end: null,
      year: "2000",
      confidence: "low",
      isCurrent: false,
    });
  });

  it("с 2019 по настоящее время -> год без выдуманного месяца, isCurrent", () => {
    expect(extractDateRange("работаю с 2019 по настоящее время")).toEqual({
      start: null,
      end: null,
      year: "2019",
      confidence: "low",
      isCurrent: true,
    });
  });

  it("месяц + голый год -> confidence medium, конец не выдумывается", () => {
    expect(extractDateRange("работал с 2003-10 по 2005")).toEqual({
      start: "2003-10",
      end: null,
      year: "2005",
      confidence: "medium",
      isCurrent: false,
    });
  });

  it("голый год перед месяцем -> начало не подставляется", () => {
    expect(extractDateRange("работал с 2003 по 2005-07")).toEqual({
      start: null,
      end: null,
      year: "2003",
      confidence: "medium",
      isCurrent: false,
    });
  });

  it("предложный падеж: в октябре 2003 -> 2003-10, confidence high", () => {
    expect(extractDateRange("работал в октябре 2003")).toEqual({
      start: "2003-10",
      end: "2003-10",
      year: null,
      confidence: "high",
      isCurrent: false,
    });
  });

  it("пустая строка -> confidence null", () => {
    expect(extractDateRange("")).toEqual({
      start: null,
      end: null,
      year: null,
      confidence: null,
      isCurrent: false,
    });
  });
});
