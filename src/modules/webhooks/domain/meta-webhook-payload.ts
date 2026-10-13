import { z } from "zod";

// Zod schemas for the webhook bodies Meta sends to `/api/webhooks/whatsapp`.
// Built from the captured fixtures in `tests/fixtures/webhooks/` and Meta's reference:
// - https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages
// - https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/status
// Meta adds fields often (`user_id`, `from_user_id`, `pricing`, `conversation`…), so the
// schemas only describe what the CRM reads; extra fields never make parsing fail.

const WHATSAPP_BUSINESS_ACCOUNT_OBJECT = "whatsapp_business_account";
const WHATSAPP_MESSAGING_PRODUCT = "whatsapp";

/** Delivery statuses Meta reports for outbound messages (`played` is for voice messages). */
export const META_MESSAGE_STATUSES = ["sent", "delivered", "read", "played", "failed"] as const;

const metaErrorSchema = z.object({
  code: z.number(),
  title: z.string().optional(),
});

/**
 * The outer body of every WhatsApp webhook. Each `changes[].value` stays `unknown`
 * here because its shape depends on `field`; the handler registered for that field
 * validates it with its own schema.
 */
export const metaWebhookEnvelopeSchema = z.object({
  object: z.literal(WHATSAPP_BUSINESS_ACCOUNT_OBJECT),
  entry: z.array(
    z.object({
      id: z.string(),
      changes: z.array(
        z.object({
          field: z.string(),
          value: z.unknown(),
        }),
      ),
    }),
  ),
});

/** A parsed WhatsApp webhook envelope. */
export type MetaWebhookEnvelope = z.infer<typeof metaWebhookEnvelopeSchema>;

/** Sender profile that Meta sends next to inbound messages. */
const metaContactSchema = z.object({
  profile: z.object({ name: z.string().optional() }).optional(),
  wa_id: z.string().optional(),
  user_id: z.string().optional(),
});

/**
 * One inbound message. It is a loose object on purpose: the type-specific payload
 * (`image`, `reaction`, `unsupported`, `errors`…) is kept untouched so the inbound
 * content registry can read it; only `text` is validated here.
 */
const metaInboundMessageSchema = z.looseObject({
  from: z.string().optional(),
  from_user_id: z.string().optional(),
  id: z.string(),
  // Unix time in seconds, sent as a string.
  timestamp: z.string(),
  type: z.string(),
  text: z.object({ body: z.string() }).optional(),
});

/** A status update (sent/delivered/read/played/failed) for a message the business sent. */
const metaMessageStatusSchema = z.object({
  id: z.string(),
  status: z.enum(META_MESSAGE_STATUSES),
  // Unix time in seconds, sent as a string.
  timestamp: z.string(),
  recipient_id: z.string().optional(),
  errors: z.array(metaErrorSchema).optional(),
});

/**
 * The `value` of a change whose `field` is "messages": inbound messages, status
 * updates of outbound messages, or value-level errors. `metadata.phone_number_id`
 * is required so the CRM can ignore events for other phone numbers.
 */
export const metaMessagesChangeValueSchema = z.object({
  messaging_product: z.literal(WHATSAPP_MESSAGING_PRODUCT),
  metadata: z.object({
    display_phone_number: z.string(),
    phone_number_id: z.string(),
  }),
  contacts: z.array(metaContactSchema).optional(),
  messages: z.array(metaInboundMessageSchema).optional(),
  statuses: z.array(metaMessageStatusSchema).optional(),
  errors: z.array(metaErrorSchema).optional(),
});

/** A parsed "messages" change value. */
export type MetaMessagesChangeValue = z.infer<typeof metaMessagesChangeValueSchema>;

/** One inbound message from a "messages" change (type-specific keys are kept). */
export type MetaInboundMessage = z.infer<typeof metaInboundMessageSchema>;

/** One outbound message status update from a "messages" change. */
export type MetaMessageStatus = z.infer<typeof metaMessageStatusSchema>;

/** A delivery status value reported by Meta. */
export type MetaMessageStatusValue = (typeof META_MESSAGE_STATUSES)[number];
