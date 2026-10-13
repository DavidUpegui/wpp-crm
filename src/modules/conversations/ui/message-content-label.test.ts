import { describe, expect, it } from "vitest";

import {
  describeMessageContent,
  isUnsupportedMessage,
} from "@/modules/conversations/ui/message-content-label";

describe("describeMessageContent", () => {
  it("shows the body of a text message", () => {
    expect(describeMessageContent({ type: "text", text: "Hola" })).toBe("Hola");
  });

  it("names a known non-text type in Spanish (AC-2.4)", () => {
    expect(describeMessageContent({ type: "image", text: null })).toBe(
      "Mensaje de tipo imagen no soportado aún",
    );
  });

  it("keeps the raw name of an unknown type", () => {
    expect(describeMessageContent({ type: "order", text: null })).toBe(
      "Mensaje de tipo order no soportado aún",
    );
  });

  it("does not read type names from the object prototype", () => {
    expect(describeMessageContent({ type: "constructor", text: null })).toBe(
      "Mensaje de tipo constructor no soportado aún",
    );
  });
});

describe("isUnsupportedMessage", () => {
  it("is false for a text message with a body", () => {
    expect(isUnsupportedMessage({ type: "text", text: "Hola" })).toBe(false);
  });

  it("is true for any other type", () => {
    expect(isUnsupportedMessage({ type: "sticker", text: null })).toBe(true);
  });
});
