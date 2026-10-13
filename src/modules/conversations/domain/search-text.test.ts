import { describe, expect, it } from "vitest";

import { extractDigits, normalizeSearchText } from "./search-text";

describe("normalizeSearchText", () => {
  it("removes accents so José matches jose", () => {
    expect(normalizeSearchText("José")).toBe(normalizeSearchText("jose"));
  });

  it("ignores letter case", () => {
    expect(normalizeSearchText("MARÍA López")).toBe("maria lopez");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeSearchText("  Ana  ")).toBe("ana");
  });

  it("keeps ñ as n so Muñoz matches munoz", () => {
    expect(normalizeSearchText("Muñoz")).toBe("munoz");
  });
});

describe("extractDigits", () => {
  it("keeps only the digits of a formatted phone number", () => {
    expect(extractDigits("+57 300-123")).toBe("57300123");
  });

  it("returns an empty string when there are no digits", () => {
    expect(extractDigits("José")).toBe("");
  });
});
