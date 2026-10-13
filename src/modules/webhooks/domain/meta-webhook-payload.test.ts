import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { metaMessagesChangeValueSchema, metaWebhookEnvelopeSchema } from "./meta-webhook-payload";

const FIXTURES_DIRECTORY = new URL("../../../../tests/fixtures/webhooks/", import.meta.url);

const fixtureFileNames = readdirSync(FIXTURES_DIRECTORY).filter((fileName) =>
  fileName.endsWith(".json"),
);

function readFixture(fileName: string): unknown {
  return JSON.parse(readFileSync(new URL(fileName, FIXTURES_DIRECTORY), "utf8"));
}

function firstChangeValueOf(fileName: string): unknown {
  const envelope = metaWebhookEnvelopeSchema.parse(readFixture(fileName));
  return envelope.entry[0].changes[0].value;
}

describe("metaWebhookEnvelopeSchema and metaMessagesChangeValueSchema", () => {
  it("finds the captured fixtures", () => {
    expect(fixtureFileNames.length).toBeGreaterThan(0);
  });

  it.each(fixtureFileNames)("parses the fixture %s and its messages change value", (fileName) => {
    const envelope = metaWebhookEnvelopeSchema.parse(readFixture(fileName));

    for (const entry of envelope.entry) {
      for (const change of entry.changes) {
        expect(change.field).toBe("messages");
        expect(metaMessagesChangeValueSchema.safeParse(change.value).success).toBe(true);
      }
    }
  });

  it("rejects a messages value without metadata.phone_number_id", () => {
    const value = {
      messaging_product: "whatsapp",
      metadata: { display_phone_number: "15550000000" },
      messages: [],
    };

    expect(metaMessagesChangeValueSchema.safeParse(value).success).toBe(false);
  });

  it("exposes the text body of the text fixture", () => {
    const value = metaMessagesChangeValueSchema.parse(firstChangeValueOf("text-message.json"));

    expect(value.messages?.[0].text?.body).toBe("Hola");
  });

  it("keeps the type-specific image object of the image fixture", () => {
    const value = metaMessagesChangeValueSchema.parse(firstChangeValueOf("image-message.json"));
    const message = value.messages?.[0];

    expect(message?.type).toBe("image");
    expect(message).toHaveProperty("image.mime_type", "image/jpeg");
  });

  it("reads the error code of the failed status fixture", () => {
    const value = metaMessagesChangeValueSchema.parse(firstChangeValueOf("status-failed.json"));

    expect(value.statuses?.[0].status).toBe("failed");
    expect(value.statuses?.[0].errors?.[0].code).toBe(131030);
  });

  it("rejects a status that Meta does not define", () => {
    const value = {
      messaging_product: "whatsapp",
      metadata: { display_phone_number: "15550000000", phone_number_id: "100000000000002" },
      statuses: [{ id: "wamid.1", status: "lost", timestamp: "1791856300" }],
    };

    expect(metaMessagesChangeValueSchema.safeParse(value).success).toBe(false);
  });
});
