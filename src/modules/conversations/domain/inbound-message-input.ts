/**
 * A customer message as the webhooks module hands it over (FR-005–FR-007),
 * already parsed from Meta's payload so this module does not know its shape.
 */
export interface InboundMessageInput {
  /** Meta's "wamid"; used to ignore duplicate webhook deliveries (BR-002). */
  waMessageId: string;
  /** Customer WhatsApp number, digits only. */
  fromWaId: string;
  profileName: string | null;
  type: string;
  /** Text body; null for types this spec only shows as a placeholder. */
  text: string | null;
  /** The time WhatsApp says the customer sent it. */
  sentAt: Date;
}
