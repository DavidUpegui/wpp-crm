import { describe, expect, it } from "vitest";

import { EmptyReplyTextError, ReplyTextTooLongError } from "./errors";
import { MAX_REPLY_TEXT_LENGTH, validateReplyText } from "./reply-text";

function textOfLength(length: number): string {
  return "a".repeat(length);
}

describe("validateReplyText", () => {
  it("rejects an empty reply", () => {
    expect(() => validateReplyText("")).toThrow(EmptyReplyTextError);
  });

  it("rejects a reply with only whitespace", () => {
    expect(() => validateReplyText("  \n\t ")).toThrow(EmptyReplyTextError);
  });

  it("returns the reply without surrounding whitespace", () => {
    expect(validateReplyText("  Hola, ¿cómo estás?\n")).toBe("Hola, ¿cómo estás?");
  });

  it("accepts a reply of exactly 4096 characters", () => {
    const text = textOfLength(MAX_REPLY_TEXT_LENGTH);

    expect(validateReplyText(text)).toBe(text);
  });

  it("rejects a reply of 4097 characters with the maximum length in the details", () => {
    let thrownError: unknown;
    try {
      validateReplyText(textOfLength(MAX_REPLY_TEXT_LENGTH + 1));
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(ReplyTextTooLongError);
    expect((thrownError as ReplyTextTooLongError).details).toEqual({ maxLength: "4096" });
  });
});
