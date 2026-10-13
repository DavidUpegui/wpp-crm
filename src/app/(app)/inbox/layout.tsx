import { Suspense } from "react";

import { AppQueryClientProvider } from "@/components/query-client-provider";
import type { InboxActions } from "@/modules/conversations/ui/inbox-actions";
import { InboxScreen, InboxScreenSkeleton } from "@/modules/conversations/ui/inbox-screen";

import { markConversationReadAction, sendReplyAction } from "./actions";

/** The inbox Server Actions; each one checks the session itself. */
const INBOX_ACTIONS: InboxActions = {
  sendReply: sendReplyAction,
  markConversationRead: markConversationReadAction,
};

/**
 * Shared frame of `/inbox` and `/inbox/<id>` (FR-020, AC-7.1).
 *
 * Why the screen lives here and not in the page: Next.js remounts the page
 * every time the conversation in the URL changes, but keeps this layout
 * mounted. So the TanStack Query cache, the single live connection (SSE) and
 * the list stay alive from `/inbox/A` to `/inbox/B`; the screen reads the
 * open conversation from the URL itself.
 *
 * No session or request data is read here. The page next to it checks the
 * session itself (AGENTS.md §12); this layout only sends client code, and
 * every request that code makes (`/api/conversations`, `/api/realtime`, the
 * Server Actions) rejects users who are not signed in.
 */
export default function InboxLayout({ children }: LayoutProps<"/inbox">): React.JSX.Element {
  return (
    <AppQueryClientProvider>
      {/* The screen reads the URL (params, search), which needs a <Suspense> with Cache Components. */}
      <Suspense fallback={<InboxScreenSkeleton />}>
        <InboxScreen actions={INBOX_ACTIONS} />
      </Suspense>
      {children}
    </AppQueryClientProvider>
  );
}
