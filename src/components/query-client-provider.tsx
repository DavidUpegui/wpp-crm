"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

/**
 * How long fetched inbox data counts as fresh. Live updates (SSE) invalidate
 * the affected queries on every change, so a short stale time is only a
 * safety net for missed events.
 */
const DEFAULT_STALE_TIME_MS = 30_000;

/**
 * Gives client components access to one TanStack Query cache per browser tab.
 *
 * Why `useState`: the `QueryClient` is created once when the component first
 * renders and kept for the life of the tab, so re-renders never throw the
 * cache away and two users on the same server never share one.
 */
export function AppQueryClientProvider({ children }: { children: ReactNode }): ReactNode {
  const [queryClient] = useState(createQueryClient);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: DEFAULT_STALE_TIME_MS,
        refetchOnWindowFocus: true,
      },
    },
  });
}
