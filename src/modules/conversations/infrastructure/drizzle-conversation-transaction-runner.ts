import "server-only";

import type {
  ConversationTransactionRepositories,
  ConversationTransactionRunner,
} from "@/modules/conversations/domain/conversation-transaction-runner";
import type { Database } from "@/shared/db/database";

import { DrizzleContactRepository } from "./drizzle-contact-repository";
import { DrizzleConversationRepository } from "./drizzle-conversation-repository";
import { DrizzleMessageRepository } from "./drizzle-message-repository";

/**
 * `ConversationTransactionRunner` backed by a Drizzle (Postgres) transaction. The work
 * gets repositories bound to that transaction, so a contact, its conversation and a
 * message are written together or not at all (AGENTS.md §9).
 */
export class DrizzleConversationTransactionRunner implements ConversationTransactionRunner {
  private readonly database: Database;

  constructor(database: Database) {
    this.database = database;
  }

  async run<T>(work: (repositories: ConversationTransactionRepositories) => Promise<T>): Promise<T> {
    // Drizzle commits when the callback resolves. When it throws, Drizzle rolls the
    // transaction back and rethrows the same error, so callers still get our typed errors.
    return this.database.transaction(async (transaction) =>
      work({
        contacts: new DrizzleContactRepository(transaction),
        conversations: new DrizzleConversationRepository(transaction),
        messages: new DrizzleMessageRepository(transaction),
      }),
    );
  }
}
