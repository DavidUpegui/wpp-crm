import "server-only";

/**
 * Composition root — the ONLY place that knows which concrete class
 * implements each interface (Dependency Inversion Principle).
 *
 * Use cases receive their dependencies as interfaces; this file builds them
 * with the real implementations. Tests build the same use cases with fakes.
 *
 * Example (added as features are implemented):
 *
 *   const conversationRepository = new DrizzleConversationRepository(db);
 *   const messageSender = new MetaMessageSender(graphClient);
 *
 *   export const sendTextMessage = createSendTextMessage({
 *     conversationRepository,
 *     messageSender,
 *   });
 */
export {};
