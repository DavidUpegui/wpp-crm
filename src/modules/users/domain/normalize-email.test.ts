import { describe, expect, it } from "vitest";

import { normalizeEmail } from "./normalize-email";

describe("normalizeEmail", () => {
  it("removes surrounding spaces", () => {
    expect(normalizeEmail("  ana@example.com  ")).toBe("ana@example.com");
  });

  it("removes surrounding tabs and line breaks", () => {
    expect(normalizeEmail("\tana@example.com\n")).toBe("ana@example.com");
  });

  it("lower-cases the address", () => {
    expect(normalizeEmail("Ana.Perez@Example.COM")).toBe("ana.perez@example.com");
  });

  it("handles mixed case and spaces together", () => {
    expect(normalizeEmail("   ANA@Example.Com ")).toBe("ana@example.com");
  });

  it("leaves an already-normalized email unchanged", () => {
    expect(normalizeEmail("ana@example.com")).toBe("ana@example.com");
  });
});
