"use client";

import { SearchIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { SEARCH_PLACEHOLDER } from "@/modules/conversations/ui/messages";

const SEARCH_INPUT_ID = "conversation-search";

/** Read by screen readers only: the placeholder already says what to type. */
const SEARCH_LABEL = "Buscar conversaciones";

/** Props of {@link ConversationSearch}. */
export interface ConversationSearchProps {
  /** What the user has typed so far (not trimmed, not debounced). */
  value: string;
  onChange: (value: string) => void;
}

/**
 * Search box above the conversation list (FR-012, AC-3.2). It only shows and
 * reports the typed text; the list decides when to search (debounce) and
 * keeps the search in the URL.
 */
export function ConversationSearch({ value, onChange }: ConversationSearchProps): React.ReactElement {
  return (
    <div role="search" className="relative">
      <label htmlFor={SEARCH_INPUT_ID} className="sr-only">
        {SEARCH_LABEL}
      </label>
      <SearchIcon
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        id={SEARCH_INPUT_ID}
        type="search"
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={SEARCH_PLACEHOLDER}
        className="h-9 bg-card pl-9 text-body md:text-body"
      />
    </div>
  );
}
