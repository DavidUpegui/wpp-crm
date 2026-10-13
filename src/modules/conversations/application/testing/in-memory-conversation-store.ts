// TEST-ONLY fake. Never import this file from production code.
//
// One store holds contacts, conversations and messages in shared arrays, so the
// three repositories see each other's writes and `run` can roll all of them back
// together, just like one database transaction would.

import type { Contact } from "@/modules/conversations/domain/contact";
import type {
  ContactRepository,
  UpsertContactInput,
} from "@/modules/conversations/domain/contact-repository";
import type { Conversation } from "@/modules/conversations/domain/conversation";
import type { ConversationRepository } from "@/modules/conversations/domain/conversation-repository";
import type {
  ConversationTransactionRepositories,
  ConversationTransactionRunner,
} from "@/modules/conversations/domain/conversation-transaction-runner";
import type { Message } from "@/modules/conversations/domain/message";
import type {
  MessageRepository,
  NewInboundMessage,
  NewOutboundMessage,
} from "@/modules/conversations/domain/message-repository";

const CONTACT_ID_PREFIX = "contact-";
const CONVERSATION_ID_PREFIX = "conversation-";
const MESSAGE_ID_PREFIX = "message-";

/** Everything the store keeps; copied as a whole to take a rollback snapshot. */
type StoreState = {
  contacts: Contact[];
  conversations: Conversation[];
  messages: Message[];
  nextContactNumber: number;
  nextConversationNumber: number;
  nextMessageNumber: number;
};

/**
 * In-memory `ContactRepository`, `ConversationRepository`, `MessageRepository`
 * and `ConversationTransactionRunner` for use case tests. Use the
 * `contacts` / `conversations` / `messages` repositories directly to arrange
 * data, and the `all…()` helpers to assert on what was stored. It always
 * returns copies, so a test cannot change stored data by accident.
 */
export class InMemoryConversationStore implements ConversationTransactionRunner {
  readonly contacts: ContactRepository;
  readonly conversations: ConversationRepository;
  readonly messages: MessageRepository;
  private state: StoreState = createEmptyState();

  constructor(options: { now?: () => Date } = {}) {
    const now = options.now ?? ((): Date => new Date());
    const getState = (): StoreState => this.state;
    this.contacts = new InMemoryContactRepository(getState, now);
    this.conversations = new InMemoryConversationRepository(getState);
    this.messages = new InMemoryMessageRepository(getState);
  }

  /**
   * Runs `work` with the store's repositories. When `work` throws, every change
   * it made is undone and the error is rethrown (fake rollback).
   */
  async run<T>(work: (repositories: ConversationTransactionRepositories) => Promise<T>): Promise<T> {
    const snapshot = copyState(this.state);
    try {
      return await work({
        contacts: this.contacts,
        conversations: this.conversations,
        messages: this.messages,
      });
    } catch (error) {
      this.state = snapshot;
      throw error;
    }
  }

  /** Test helper: copies of every stored contact, in creation order. */
  allContacts(): Contact[] {
    return this.state.contacts.map(copyContact);
  }

  /** Test helper: copies of every stored conversation, in creation order. */
  allConversations(): Conversation[] {
    return this.state.conversations.map(copyConversation);
  }

  /** Test helper: copies of every stored message, in creation order. */
  allMessages(): Message[] {
    return this.state.messages.map(copyMessage);
  }
}

class InMemoryContactRepository implements ContactRepository {
  constructor(
    private readonly getState: () => StoreState,
    private readonly now: () => Date,
  ) {}

  async findById(contactId: string): Promise<Contact | null> {
    const contact = this.getState().contacts.find((storedContact) => storedContact.id === contactId);
    return contact ? copyContact(contact) : null;
  }

  async upsertByWaId(input: UpsertContactInput): Promise<Contact> {
    const state = this.getState();
    const existingContact = state.contacts.find((contact) => contact.waId === input.waId);

    if (existingContact) {
      // A missing name in the webhook never erases the name we already know (AC-2.3).
      if (input.profileName !== null) {
        existingContact.profileName = input.profileName;
      }
      return copyContact(existingContact);
    }

    const contact: Contact = {
      id: `${CONTACT_ID_PREFIX}${state.nextContactNumber}`,
      waId: input.waId,
      profileName: input.profileName,
      createdAt: this.now(),
    };
    state.nextContactNumber += 1;
    state.contacts.push(contact);
    return copyContact(contact);
  }
}

class InMemoryConversationRepository implements ConversationRepository {
  constructor(private readonly getState: () => StoreState) {}

  async findById(conversationId: string): Promise<Conversation | null> {
    const conversation = this.getState().conversations.find(
      (storedConversation) => storedConversation.id === conversationId,
    );
    return conversation ? copyConversation(conversation) : null;
  }

  async findOrCreateForContact(contactId: string, now: Date): Promise<Conversation> {
    const state = this.getState();
    const existingConversation = state.conversations.find(
      (conversation) => conversation.contactId === contactId,
    );
    if (existingConversation) {
      return copyConversation(existingConversation);
    }

    const conversation: Conversation = {
      id: `${CONVERSATION_ID_PREFIX}${state.nextConversationNumber}`,
      contactId,
      lastInboundAt: null,
      lastActivityAt: new Date(now),
      lastMessageId: null,
      unreadCount: 0,
    };
    state.nextConversationNumber += 1;
    state.conversations.push(conversation);
    return copyConversation(conversation);
  }

  async update(conversation: Conversation): Promise<void> {
    const conversations = this.getState().conversations;
    const index = conversations.findIndex((stored) => stored.id === conversation.id);
    if (index === -1) {
      return;
    }
    conversations[index] = copyConversation(conversation);
  }
}

class InMemoryMessageRepository implements MessageRepository {
  constructor(private readonly getState: () => StoreState) {}

  async insertInboundIfNew(newMessage: NewInboundMessage): Promise<Message | null> {
    const state = this.getState();
    const isDuplicate = state.messages.some(
      (message) => message.waMessageId === newMessage.waMessageId,
    );
    // Mirrors the UNIQUE index on wa_message_id + ON CONFLICT DO NOTHING (BR-002).
    if (isDuplicate) {
      return null;
    }

    const message: Message = {
      id: this.generateId(state),
      conversationId: newMessage.conversationId,
      direction: "inbound",
      waMessageId: newMessage.waMessageId,
      type: newMessage.type,
      text: newMessage.text,
      sentAt: new Date(newMessage.sentAt),
      status: null,
      failureReason: null,
      sentByUserId: null,
    };
    state.messages.push(message);
    return copyMessage(message);
  }

  async insertOutbound(newMessage: NewOutboundMessage): Promise<Message> {
    const state = this.getState();
    const message: Message = {
      id: this.generateId(state),
      conversationId: newMessage.conversationId,
      direction: "outbound",
      waMessageId: null,
      type: newMessage.type,
      text: newMessage.text,
      sentAt: new Date(newMessage.sentAt),
      status: "queued",
      failureReason: null,
      sentByUserId: newMessage.sentByUserId,
    };
    state.messages.push(message);
    return copyMessage(message);
  }

  async findByWaMessageId(waMessageId: string): Promise<Message | null> {
    const message = this.getState().messages.find(
      (storedMessage) => storedMessage.waMessageId === waMessageId,
    );
    return message ? copyMessage(message) : null;
  }

  async update(message: Message): Promise<void> {
    const storedMessage = this.getState().messages.find((stored) => stored.id === message.id);
    if (!storedMessage) {
      return;
    }
    // Like the real repository, only these three fields can change.
    storedMessage.status = message.status;
    storedMessage.failureReason = message.failureReason;
    storedMessage.waMessageId = message.waMessageId;
  }

  private generateId(state: StoreState): string {
    const id = `${MESSAGE_ID_PREFIX}${state.nextMessageNumber}`;
    state.nextMessageNumber += 1;
    return id;
  }
}

function createEmptyState(): StoreState {
  return {
    contacts: [],
    conversations: [],
    messages: [],
    nextContactNumber: 1,
    nextConversationNumber: 1,
    nextMessageNumber: 1,
  };
}

function copyState(state: StoreState): StoreState {
  return {
    contacts: state.contacts.map(copyContact),
    conversations: state.conversations.map(copyConversation),
    messages: state.messages.map(copyMessage),
    nextContactNumber: state.nextContactNumber,
    nextConversationNumber: state.nextConversationNumber,
    nextMessageNumber: state.nextMessageNumber,
  };
}

function copyContact(contact: Contact): Contact {
  return { ...contact, createdAt: new Date(contact.createdAt) };
}

function copyConversation(conversation: Conversation): Conversation {
  return {
    ...conversation,
    lastInboundAt: conversation.lastInboundAt ? new Date(conversation.lastInboundAt) : null,
    lastActivityAt: new Date(conversation.lastActivityAt),
  };
}

function copyMessage(message: Message): Message {
  return { ...message, sentAt: new Date(message.sentAt) };
}
