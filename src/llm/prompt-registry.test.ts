import { describe, expect, it } from "vitest";
import { getPromptSpec, promptRegistry, UnknownPromptError } from "./prompt-registry";

describe("getPromptSpec()", () => {
  it("extraction возвращает spec со схемой", () => {
    const spec = getPromptSpec("extraction");

    expect(spec.id).toBe("extraction");
    expect(spec.version).toBe(1);
    expect(spec.outputFormat).toBe("json");
    expect(spec.schema.safeParse({ claims: [] }).success).toBe(true);
  });

  it("unknown бросает UnknownPromptError", () => {
    expect(() => getPromptSpec("unknown")).toThrow(UnknownPromptError);
  });

  it("все 6 id присутствуют", () => {
    const ids = Object.keys(promptRegistry).sort();

    expect(ids).toEqual([
      "extraction",
      "generation_aipo",
      "generation_sales",
      "generation_salesops",
      "roles",
      "verification",
    ]);
  });
});
