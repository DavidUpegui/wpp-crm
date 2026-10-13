"use client";

import { Button } from "@/components/ui/button";
import { LOAD_OLDER_MESSAGES_LABEL, LOADING_LABEL } from "@/modules/conversations/ui/messages";

/** Props of {@link LoadOlderButton}. */
export interface LoadOlderButtonProps {
  /** False on the oldest page: the button is not shown at all. */
  hasOlderMessages: boolean;
  isLoading: boolean;
  onLoadOlder: () => void;
}

/**
 * "Cargar anteriores" at the top of the thread (AC-4.2): loads the previous
 * page of messages. It says "Cargando…" while the page is on its way and
 * disappears once the first message of the conversation is shown.
 */
export function LoadOlderButton({
  hasOlderMessages,
  isLoading,
  onLoadOlder,
}: LoadOlderButtonProps): React.ReactElement | null {
  if (!hasOlderMessages) {
    return null;
  }

  function handleClick(): void {
    if (isLoading) {
      return;
    }
    onLoadOlder();
  }

  return (
    <div className="flex justify-center pb-4">
      {/* `aria-disabled`, not `disabled`: disabling the focused button would drop keyboard focus to <body>. */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-full px-3 text-meta aria-disabled:opacity-50"
        aria-disabled={isLoading}
        aria-busy={isLoading}
        onClick={handleClick}
      >
        {isLoading ? LOADING_LABEL : LOAD_OLDER_MESSAGES_LABEL}
      </Button>
    </div>
  );
}
