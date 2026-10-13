"use client";

import { useMutation, useMutationState, useQueryClient } from "@tanstack/react-query";
import { Lock, SendHorizontal } from "lucide-react";
import { useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ThreadMessage } from "@/modules/conversations/domain/inbox-views";
import { MAX_REPLY_TEXT_LENGTH } from "@/modules/conversations/domain/reply-text";
import { FAILURE_REASON_MESSAGES } from "@/modules/conversations/ui/failure-reason-messages";
import type { SendReplyAction, SendReplyResult } from "@/modules/conversations/ui/inbox-actions";
import { INBOX_QUERY_KEYS } from "@/modules/conversations/ui/inbox-queries";
import {
  COMPOSER_PLACEHOLDER,
  EMPTY_REPLY_MESSAGE,
  formatCharacterCounter,
  REPLY_ERROR_MESSAGES,
  REPLY_TOO_LONG_MESSAGE,
  SEND_LABEL,
  WINDOW_CLOSED_REASON,
} from "@/modules/conversations/ui/messages";
import { useWindowCountdown } from "@/modules/conversations/ui/use-window-countdown";

/** The counter appears this close to WhatsApp's limit, so it does not distract on normal replies (spec §10). */
const CHARACTER_COUNTER_THRESHOLD = 3900;

/** The text box grows with its content up to this many lines, then scrolls. */
const MAX_VISIBLE_LINES = 6;

/** Shown when the action fails without a known error code (e.g. the network dropped). */
const GENERIC_SEND_ERROR_MESSAGE = FAILURE_REASON_MESSAGES.unknown;

const PENDING_ID_PREFIX = "pending-";

/**
 * Grows with the content where `field-sizing` is supported; `rows` is the fallback elsewhere.
 * The `6lh` max height mirrors MAX_VISIBLE_LINES (Tailwind needs the literal value).
 */
const TEXTAREA_CLASS_NAME = cn(
  "block w-full min-w-0 flex-1 resize-none rounded-lg border border-input bg-card px-3 py-2 text-body",
  "field-sizing-content max-h-[calc(6lh+1rem+2px)] overflow-y-auto",
  "placeholder:text-muted-foreground outline-none transition-colors",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70",
);

/**
 * The ring is offset and fully opaque: on the Lagoon button the default
 * half-transparent ring (and the Lagoon focus border) are almost invisible.
 */
const SEND_BUTTON_CLASS_NAME =
  "h-[calc(1lh+1rem+2px)] px-3.5 text-body focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";

/** Every pending reply gets a different temporary id, even two sent in the same millisecond. */
let pendingReplySequence = 0;

/** What one send carries; also what {@link usePendingReplies} turns into "Enviando" bubbles. */
interface PendingReplyVariables {
  temporaryId: string;
  text: string;
  submittedAt: Date;
}

/** Props of {@link ReplyComposer}. */
export interface ReplyComposerProps {
  conversationId: string;
  /** When the customer last wrote; null when they never did (the window is closed). */
  lastInboundAt: Date | null;
  sendReply: SendReplyAction;
}

/**
 * The reply box at the bottom of an open conversation (FR-015–FR-018,
 * AC-5.1–AC-5.5). It checks the reply before sending (not empty, at most
 * 4096 characters, 24h window open) and clears itself at once, so the team
 * keeps typing while WhatsApp answers. The "Enviando" bubble is NOT drawn
 * here: the thread shows it with {@link usePendingReplies}.
 *
 * Mount it with `key={conversationId}` so a draft never jumps to another conversation.
 */
export function ReplyComposer({ conversationId, lastInboundAt, sendReply }: ReplyComposerProps): React.ReactElement {
  const { isOpen } = useWindowCountdown(lastInboundAt);
  const sendReplyMutation = useSendReplyMutation(conversationId, sendReply);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const textareaId = useId();
  const closedReasonId = useId();
  const noticeId = useId();
  const tooLongMessageId = useId();

  const trimmedText = text.trim();
  const isTooLong = trimmedText.length > MAX_REPLY_TEXT_LENGTH;
  const isSendDisabled = !isOpen || trimmedText.length === 0 || isTooLong;

  async function submitReply(): Promise<void> {
    if (!isOpen || isTooLong) {
      return;
    }
    if (trimmedText.length === 0) {
      setNotice(EMPTY_REPLY_MESSAGE);
      return;
    }

    // Optimistic: clear the box now; the thread shows the reply as "Enviando".
    setText("");
    setNotice(null);
    textareaRef.current?.focus();

    const errorMessage = await sendAndDescribeError(sendReplyMutation.mutateAsync, trimmedText);
    if (errorMessage === null) {
      return;
    }
    setNotice(errorMessage);
    restoreTextForRetry(trimmedText);
  }

  /** Puts the reply back so it can be sent again, unless the user already started a new one. */
  function restoreTextForRetry(failedText: string): void {
    setText((currentText) => (currentText === "" ? failedText : currentText));
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>): void {
    // While an IME is composing (e.g. accents on some keyboards), Enter confirms the character.
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) {
      return;
    }
    event.preventDefault();
    void submitReply();
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void submitReply();
  }

  function handleChange(event: React.ChangeEvent<HTMLTextAreaElement>): void {
    setText(event.target.value);
    setNotice(null);
  }

  return (
    <form onSubmit={handleSubmit} className="border-t border-border bg-card px-4 py-3 md:px-6">
      {!isOpen && <ClosedWindowReason id={closedReasonId} />}
      <div className="flex items-end gap-2">
        <label htmlFor={textareaId} className="sr-only">
          {COMPOSER_PLACEHOLDER}
        </label>
        <textarea
          ref={textareaRef}
          id={textareaId}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={COMPOSER_PLACEHOLDER}
          disabled={!isOpen}
          rows={countVisibleRows(text)}
          aria-invalid={isTooLong}
          aria-describedby={describedByIds({ isOpen, closedReasonId, notice, noticeId, isTooLong, tooLongMessageId })}
          className={TEXTAREA_CLASS_NAME}
        />
        <Button type="submit" size="lg" disabled={isSendDisabled} className={SEND_BUTTON_CLASS_NAME}>
          <SendHorizontal aria-hidden="true" />
          {SEND_LABEL}
        </Button>
      </div>
      <ComposerFooter
        length={trimmedText.length}
        isTooLong={isTooLong}
        notice={notice}
        noticeId={noticeId}
        tooLongMessageId={tooLongMessageId}
      />
    </form>
  );
}

/**
 * The replies of one conversation that are still on their way to WhatsApp,
 * as "Enviando" (`queued`) thread messages, oldest first. The thread appends
 * them after its loaded messages (AC-5.1). Each one disappears when its send
 * finishes and the thread has been refetched, so the saved row (sent or
 * failed) takes its place without a gap.
 */
export function usePendingReplies(conversationId: string): ThreadMessage[] {
  const pendingVariables = useMutationState({
    filters: { mutationKey: sendReplyMutationKey(conversationId), status: "pending" },
    select: (mutation) => mutation.state.variables as PendingReplyVariables | undefined,
  });

  const pendingReplies: ThreadMessage[] = [];
  for (const variables of pendingVariables) {
    if (variables !== undefined) {
      pendingReplies.push(toPendingThreadMessage(variables));
    }
  }
  return pendingReplies;
}

function useSendReplyMutation(conversationId: string, sendReply: SendReplyAction) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: sendReplyMutationKey(conversationId),
    mutationFn: (variables: PendingReplyVariables) => sendReply(conversationId, variables.text),
    // Awaited on purpose: the mutation stays "pending" (so the "Enviando"
    // bubble stays) until the thread has the saved message.
    onSuccess: async (result: SendReplyResult): Promise<void> => {
      if (!result.ok) {
        return;
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: INBOX_QUERY_KEYS.messages(conversationId) }),
        queryClient.invalidateQueries({ queryKey: INBOX_QUERY_KEYS.conversations }),
      ]);
    },
  });
}

/**
 * Sends one reply and returns the Spanish reason to show when nothing was
 * sent, or null when the action answered `ok: true`. A reply WhatsApp
 * rejected is `ok: true` too: the thread shows it as "No enviado" (AC-5.5).
 */
async function sendAndDescribeError(
  send: (variables: PendingReplyVariables) => Promise<SendReplyResult>,
  text: string,
): Promise<string | null> {
  pendingReplySequence += 1;
  const submittedAt = new Date();
  const variables: PendingReplyVariables = {
    temporaryId: `${PENDING_ID_PREFIX}${submittedAt.getTime()}-${pendingReplySequence}`,
    text,
    submittedAt,
  };

  try {
    const result = await send(variables);
    if (result.ok) {
      return null;
    }
    return REPLY_ERROR_MESSAGES[result.error] ?? GENERIC_SEND_ERROR_MESSAGE;
  } catch {
    return GENERIC_SEND_ERROR_MESSAGE;
  }
}

/** Visible (not only a placeholder) so the team knows why the box is locked (AC-5.2). */
function ClosedWindowReason({ id }: { id: string }): React.ReactElement {
  return (
    <p id={id} className="mb-2 flex items-start gap-1.5 text-meta text-muted-foreground">
      <Lock aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
      {WINDOW_CLOSED_REASON}
    </p>
  );
}

interface ComposerFooterProps {
  length: number;
  isTooLong: boolean;
  notice: string | null;
  noticeId: string;
  tooLongMessageId: string;
}

/** Inline messages under the box: send errors / empty reply, the limit, and the counter near the limit. */
function ComposerFooter({
  length,
  isTooLong,
  notice,
  noticeId,
  tooLongMessageId,
}: ComposerFooterProps): React.ReactElement {
  const isCounterVisible = length >= CHARACTER_COUNTER_THRESHOLD;

  return (
    <div className="flex flex-wrap items-start justify-between gap-x-3 text-meta">
      {notice !== null && (
        <p id={noticeId} role="alert" className="mt-1.5 text-destructive">
          {notice}
        </p>
      )}
      {/* Always mounted (not display:none) so screen readers announce the limit when it appears. */}
      <p id={tooLongMessageId} aria-live="polite" className="mt-1.5 text-destructive empty:mt-0">
        {isTooLong ? REPLY_TOO_LONG_MESSAGE : ""}
      </p>
      {isCounterVisible && (
        <p className={cn("mt-1.5 ml-auto tabular-nums", isTooLong ? "text-destructive" : "text-muted-foreground")}>
          {formatCharacterCounter(length)}
        </p>
      )}
    </div>
  );
}

interface DescribedByInput {
  isOpen: boolean;
  closedReasonId: string;
  notice: string | null;
  noticeId: string;
  isTooLong: boolean;
  tooLongMessageId: string;
}

/** Ids of the messages that explain the text box right now, so screen readers read them with it. */
function describedByIds(input: DescribedByInput): string | undefined {
  const ids: string[] = [];
  if (!input.isOpen) {
    ids.push(input.closedReasonId);
  }
  if (input.notice !== null) {
    ids.push(input.noticeId);
  }
  if (input.isTooLong) {
    ids.push(input.tooLongMessageId);
  }
  return ids.length > 0 ? ids.join(" ") : undefined;
}

function sendReplyMutationKey(conversationId: string): readonly ["send-reply", string] {
  return ["send-reply", conversationId] as const;
}

function toPendingThreadMessage(variables: PendingReplyVariables): ThreadMessage {
  return {
    id: variables.temporaryId,
    direction: "outbound",
    type: "text",
    text: variables.text,
    sentAt: variables.submittedAt,
    status: "queued",
    failureReason: null,
    senderName: null,
  };
}

/** One row per line of text, between 1 and {@link MAX_VISIBLE_LINES}. */
function countVisibleRows(text: string): number {
  const lineCount = text.split("\n").length;
  return Math.min(Math.max(lineCount, 1), MAX_VISIBLE_LINES);
}
