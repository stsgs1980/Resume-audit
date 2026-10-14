import { describe, expect, it } from "vitest";
import causalityConfig from "../../config/causality.json";
import forbiddenWordsConfig from "../../config/forbidden-words.json";
import forecastMarkersConfig from "../../config/forecast-markers.json";
import placeholdersConfig from "../../config/placeholders.json";
import {
  detectCausalityWithoutSource,
  detectForbiddenWords,
  detectForecastMarkers,
  detectPlaceholders,
} from "./detectors";

describe("Test 16: маркеры завышенного AI-позиционирования", () => {
  it('"довёл до production-стандартов" -> непустой массив', () => {
    const found = detectForbiddenWords("довёл до production-стандартов разработки", forbiddenWordsConfig.global);

    expect(found.length).toBeGreaterThan(0);
    expect(found).toContain("production");
  });
});

describe("Test 17: детектор плейсхолдеров", () => {
  it('"+7 (XXX) XXX-XX-XX" -> непустой массив', () => {
    const found = detectPlaceholders("+7 (XXX) XXX-XX-XX", placeholdersConfig.patterns);

    expect(found.length).toBeGreaterThan(0);
    expect(found).toContain("\\+7\\s*\\(XXX\\)");
  });
});

describe("Test 19: недоказанная причинность", () => {
  it("эффект у клиентов без источника -> true", () => {
    expect(
      detectCausalityWithoutSource(
        "клиенты увеличили выручку на 30 %",
        causalityConfig.sourceMarkers,
        causalityConfig.causalMarkers,
      ),
    ).toBe(true);
  });

  it("тот же эффект с источником -> false", () => {
    expect(
      detectCausalityWithoutSource(
        "по данным компании клиенты увеличили выручку на 30 %",
        causalityConfig.sourceMarkers,
        causalityConfig.causalMarkers,
      ),
    ).toBe(false);
  });

  it("явный causalMarker без источника -> true", () => {
    expect(
      detectCausalityWithoutSource(
        "благодаря новой воронке конверсия выросла",
        causalityConfig.sourceMarkers,
        causalityConfig.causalMarkers,
      ),
    ).toBe(true);
  });

  it("явный causalMarker с источником -> false", () => {
    expect(
      detectCausalityWithoutSource(
        "по данным компании благодаря новой воронке конверсия выросла",
        causalityConfig.sourceMarkers,
        causalityConfig.causalMarkers,
      ),
    ).toBe(false);
  });
});

describe("detectors: дополнительно", () => {
  it("detectForbiddenWords регистронезависимо", () => {
    expect(detectForbiddenWords("Довёл до PRODUCTION", ["production"])).toEqual(["production"]);
  });

  it('detectForecastMarkers находит "достигнет"', () => {
    const found = detectForecastMarkers("выручка достигнет 5 млн", forecastMarkersConfig.markers);

    expect(found).toContain("достигнет");
  });

  it("detectPlaceholders находит email@example.com", () => {
    const found = detectPlaceholders("пишите на email@example.com", placeholdersConfig.patterns);

    expect(found.length).toBeGreaterThan(0);
  });
});
