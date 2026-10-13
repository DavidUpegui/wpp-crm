import "server-only";
import { makeChangeOwnPassword } from "@/modules/auth/application/change-own-password";
import { makeGetCurrentUser } from "@/modules/auth/application/get-current-user";
import { makeLogIn } from "@/modules/auth/application/log-in";
import { makeLogOut } from "@/modules/auth/application/log-out";
import { makeRequireCurrentUser } from "@/modules/auth/application/require-current-user";
import { makeUpdateOwnName } from "@/modules/auth/application/update-own-name";
import { auth } from "@/modules/auth/infrastructure/better-auth";
import { BetterAuthAuthenticator } from "@/modules/auth/infrastructure/better-auth-authenticator";
import { BetterAuthPasswordHasher } from "@/modules/auth/infrastructure/better-auth-password-hasher";
import { BetterAuthSessionReader } from "@/modules/auth/infrastructure/better-auth-session-reader";
import { BetterAuthSessionRevoker } from "@/modules/auth/infrastructure/better-auth-session-revoker";
import { DrizzleLoginAttemptRepository } from "@/modules/auth/infrastructure/drizzle-login-attempt-repository";
import { makeApplyMessageStatus } from "@/modules/conversations/application/apply-message-status";
import { makeGetConversation } from "@/modules/conversations/application/get-conversation";
import { makeListConversationMessages } from "@/modules/conversations/application/list-conversation-messages";
import { makeListConversations } from "@/modules/conversations/application/list-conversations";
import { makeMarkConversationRead } from "@/modules/conversations/application/mark-conversation-read";
import { makeRecordInboundMessage } from "@/modules/conversations/application/record-inbound-message";
import { makeSendTextReply } from "@/modules/conversations/application/send-text-reply";
import { DrizzleConversationRepository } from "@/modules/conversations/infrastructure/drizzle-conversation-repository";
import { DrizzleConversationTransactionRunner } from "@/modules/conversations/infrastructure/drizzle-conversation-transaction-runner";
import { DrizzleInboxQueries } from "@/modules/conversations/infrastructure/drizzle-inbox-queries";
import { DrizzleMessageRepository } from "@/modules/conversations/infrastructure/drizzle-message-repository";
import { MetaMessageSender } from "@/modules/conversations/infrastructure/meta-message-sender";
import { PostgresInboxEventPublisher } from "@/modules/conversations/infrastructure/postgres-inbox-event-publisher";
import { makeCreateFirstAdmin } from "@/modules/users/application/create-first-admin";
import { makeCreateUser } from "@/modules/users/application/create-user";
import { makeDeactivateUser } from "@/modules/users/application/deactivate-user";
import { makeListUsers } from "@/modules/users/application/list-users";
import { makeReactivateUser } from "@/modules/users/application/reactivate-user";
import { makeResetUserPassword } from "@/modules/users/application/reset-user-password";
import { makeUpdateUser } from "@/modules/users/application/update-user";
import { DrizzleUserRepository } from "@/modules/users/infrastructure/drizzle-user-repository";
import { DrizzleUserTransactionRunner } from "@/modules/users/infrastructure/drizzle-user-transaction-runner";
import { makeHandleMessagesChange } from "@/modules/webhooks/application/handle-messages-change";
import { makeProcessWebhookPayload } from "@/modules/webhooks/application/process-webhook-payload";
import { makeReceiveWebhook } from "@/modules/webhooks/application/receive-webhook";
import { makeVerifyWebhookSubscription } from "@/modules/webhooks/application/verify-webhook-subscription";
import { DrizzleWebhookEventRepository } from "@/modules/webhooks/infrastructure/drizzle-webhook-event-repository";
import { env } from "@/shared/config/env";
import { db } from "@/shared/db/client";
import { INBOX_EVENTS_CHANNEL } from "@/shared/realtime/inbox-events-channel";
import { subscribeToChannel, type Unsubscribe } from "@/shared/realtime/subscribe-to-channel";
import { GraphClient } from "@/shared/whatsapp/graph-client";

/**
 * Composition root — the ONLY place that knows which concrete class
 * implements each interface (Dependency Inversion Principle, AGENTS.md §5.3 D).
 *
 * Use cases depend on interfaces (`UserRepository`, `Authenticator`, …) and
 * receive them as arguments. This file builds them with the real Drizzle and
 * Better Auth implementations and exports the ready-to-use use cases.
 *
 * - Routes, server actions and scripts import use cases from HERE only.
 * - Only use cases are exported, never repositories or adapters, so delivery
 *   code cannot skip the business rules by talking to the database directly.
 * - Tests do not import this file: they build the same use cases with
 *   in-memory fakes (see `src/modules/<feature>/application/testing/`).
 *
 * Importing this file only creates plain objects; the database connection
 * pool lives in `@/shared/db/client` and opens connections lazily.
 */

// ---------------------------------------------------------------------------
// Infrastructure (concrete implementations, private to this file)
// ---------------------------------------------------------------------------

const userRepository = new DrizzleUserRepository(db);
// Use cases that write several rows (user + credential) get their
// repositories from the transaction runner, so no standalone
// credential repository is needed here.
const userTransactionRunner = new DrizzleUserTransactionRunner(db);
const loginAttemptRepository = new DrizzleLoginAttemptRepository(db);
const webhookEventRepository = new DrizzleWebhookEventRepository(db);
// Inbound messages and outgoing replies write contact + conversation + message
// rows together, so they go through the transaction runner; single-row
// updates use the plain repositories.
const conversationTransactionRunner = new DrizzleConversationTransactionRunner(db);
const conversationRepository = new DrizzleConversationRepository(db);
const messageRepository = new DrizzleMessageRepository(db);
const inboxQueries = new DrizzleInboxQueries(db);
const inboxEventPublisher = new PostgresInboxEventPublisher(db);

// Every call to Meta goes through this one client (AGENTS.md §8.1).
const graphClient = new GraphClient({
  accessToken: env.WHATSAPP_ACCESS_TOKEN,
  apiVersion: env.META_GRAPH_API_VERSION,
});
const messageSender = new MetaMessageSender(graphClient, env.WHATSAPP_PHONE_NUMBER_ID);

const authenticator = new BetterAuthAuthenticator(auth);
const sessionReader = new BetterAuthSessionReader(auth);
const passwordHasher = new BetterAuthPasswordHasher(auth);
const sessionRevoker = new BetterAuthSessionRevoker(auth);

/**
 * The real clock. Use cases receive it instead of calling `new Date()`
 * themselves, so tests can pass a fixed time (e.g. for the 15-minute
 * login-block window, BR-004).
 */
const now = (): Date => new Date();

// ---------------------------------------------------------------------------
// Users use cases (admin user management)
// ---------------------------------------------------------------------------

export const createFirstAdmin = makeCreateFirstAdmin({
  transactionRunner: userTransactionRunner,
  passwordHasher,
});

export const createUser = makeCreateUser({
  transactionRunner: userTransactionRunner,
  passwordHasher,
});

export const listUsers = makeListUsers({ userRepository });

export const updateUser = makeUpdateUser({ transactionRunner: userTransactionRunner });

export const deactivateUser = makeDeactivateUser({
  transactionRunner: userTransactionRunner,
  sessionRevoker,
});

export const reactivateUser = makeReactivateUser({ userRepository });

export const resetUserPassword = makeResetUserPassword({
  transactionRunner: userTransactionRunner,
  passwordHasher,
  sessionRevoker,
});

// ---------------------------------------------------------------------------
// Auth use cases (login, session and own account)
// ---------------------------------------------------------------------------

export const logIn = makeLogIn({
  loginAttemptRepository,
  authenticator,
  userRepository,
  now,
});

export const logOut = makeLogOut({ authenticator });

export const getCurrentUser = makeGetCurrentUser({ sessionReader, userRepository });

// Built on top of `getCurrentUser`, so both always agree on who is logged in.
export const requireCurrentUser = makeRequireCurrentUser({ getCurrentUser });

export const changeOwnPassword = makeChangeOwnPassword({
  transactionRunner: userTransactionRunner,
  passwordHasher,
  sessionRevoker,
});

export const updateOwnName = makeUpdateOwnName({ userRepository });

// ---------------------------------------------------------------------------
// Conversations use cases (inbox: inbound messages, replies, statuses)
// ---------------------------------------------------------------------------

export const recordInboundMessage = makeRecordInboundMessage({
  transactionRunner: conversationTransactionRunner,
  inboxEventPublisher,
  now,
});

export const applyMessageStatus = makeApplyMessageStatus({
  messageRepository,
  inboxEventPublisher,
});

export const sendTextReply = makeSendTextReply({
  transactionRunner: conversationTransactionRunner,
  messageSender,
  inboxEventPublisher,
  now,
});

export const markConversationRead = makeMarkConversationRead({
  conversationRepository,
  inboxEventPublisher,
});

export const listConversations = makeListConversations({ inboxQueries });

export const getConversation = makeGetConversation({ inboxQueries });

export const listConversationMessages = makeListConversationMessages({ inboxQueries });

/**
 * Listens to inbox changes (`NOTIFY inbox_events`) and calls `listener` with
 * each event payload. Used by the SSE route (`/api/realtime`); each call opens
 * its own Postgres connection, closed by the returned `Unsubscribe`.
 */
export function subscribeToInboxEvents(
  listener: (event: unknown) => void,
): Promise<Unsubscribe> {
  return subscribeToChannel(env.DATABASE_URL, INBOX_EVENTS_CHANNEL, listener);
}

// ---------------------------------------------------------------------------
// Webhooks use cases (Meta WhatsApp Cloud API callbacks)
// ---------------------------------------------------------------------------

// One handler per subscribed webhook field (Open/Closed: a new field = a new
// entry here). Fields without a handler, like `message_template_status_update`
// until the templates spec, are stored and marked processed without effect.
const processWebhookPayload = makeProcessWebhookPayload({
  handlersByField: {
    messages: makeHandleMessagesChange({
      recordInboundMessage,
      applyMessageStatus,
      businessPhoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
    }),
  },
});

export const verifyWebhookSubscription = makeVerifyWebhookSubscription({
  verifyToken: env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
});

export const receiveWebhook = makeReceiveWebhook({
  webhookEventRepository,
  processWebhookPayload,
  appSecret: env.META_APP_SECRET,
});
