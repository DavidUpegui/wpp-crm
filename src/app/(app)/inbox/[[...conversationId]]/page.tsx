import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";

import { requireSignedInUser } from "@/server/require-signed-in-user";

const INBOX_PATH = "/inbox";

type InboxParams = PageProps<"/inbox/[[...conversationId]]">["params"];

export const metadata: Metadata = {
  title: "Bandeja · WPP CRM",
};

/**
 * "Bandeja" (FR-010, FR-020, FR-021): `/inbox` shows the conversation list,
 * `/inbox/<id>` also opens that conversation.
 *
 * The screen itself is rendered by `../layout.tsx`, because Next.js remounts
 * this page on every conversation change and the screen (its data cache and
 * live connection) must survive that. The page only guards the route, and
 * shows nothing while it does, so no placeholder flashes on each click.
 */
export default function InboxPage({ params }: { params: InboxParams }): React.JSX.Element {
  return (
    <Suspense fallback={null}>
      <InboxGuard params={params} />
    </Suspense>
  );
}

/**
 * Request data (params, headers) is read inside <Suspense> (Cache
 * Components). The page checks the session itself: the layout guard alone is
 * not enough, pages render independently of layouts. Admins and agents may
 * both use the inbox.
 */
async function InboxGuard({ params }: { params: InboxParams }): Promise<null> {
  const selectedConversationId = readSelectedConversationId(await params);

  // A copy, because the headers from `headers()` are read-only.
  const requestHeaders = new Headers(await headers());
  await requireSignedInUser({ requestHeaders, returnTo: buildInboxPath(selectedConversationId) });

  return null;
}

/** The open conversation from the URL: none at `/inbox`, the segments joined at `/inbox/<id>`. */
function readSelectedConversationId({ conversationId }: { conversationId?: string[] }): string | null {
  if (conversationId === undefined || conversationId.length === 0) {
    return null;
  }
  return conversationId.join("/");
}

/** Where login sends the user back to. */
function buildInboxPath(selectedConversationId: string | null): string {
  if (selectedConversationId === null) {
    return INBOX_PATH;
  }
  return `${INBOX_PATH}/${encodeURIComponent(selectedConversationId)}`;
}
