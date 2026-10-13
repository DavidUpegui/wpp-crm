import type { ContactRepository } from "./contact-repository";
import type { ConversationRepository } from "./conversation-repository";
import type { MessageRepository } from "./message-repository";

/** The repositories available inside one transaction, all bound to it. */
export type ConversationTransactionRepositories = {
  contacts: ContactRepository;
  conversations: ConversationRepository;
  messages: MessageRepository;
};

/**
 * Runs work inside one database transaction, so a contact, its conversation
 * and a message are written together or not at all (AGENTS.md §9).
 */
export interface ConversationTransactionRunner {
  /** Runs `work` in a transaction and returns its result; any error thrown rolls everything back and is rethrown. */
  run<T>(work: (repositories: ConversationTransactionRepositories) => Promise<T>): Promise<T>;
}
