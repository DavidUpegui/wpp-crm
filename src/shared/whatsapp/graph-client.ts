import "server-only";

import { z } from "zod";

import { GraphApiError } from "@/shared/whatsapp/graph-api-error";

const GRAPH_API_BASE_URL = "https://graph.facebook.com";
const MAX_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 500;
const TOO_MANY_REQUESTS_STATUS = 429;
const FIRST_SERVER_ERROR_STATUS = 500;

/** Shape of a Meta error response; only `error.code` is needed for mapping. */
const graphErrorBodySchema = z.object({
  error: z.object({
    code: z.number(),
  }),
});

type GraphClientOptions = {
  accessToken: string;
  apiVersion: string;
  fetchFunction?: typeof fetch;
  retryDelayMs?: number;
};

/**
 * Low-level HTTP client for the Meta Graph API — the ONLY place that builds
 * the Graph base URL and sends the access token (AGENTS.md §8.1).
 *
 * Why: feature adapters stay small and never deal with auth headers,
 * versioning, retries or Meta's error format.
 * - Retries with exponential backoff on 429 and 5xx only (AGENTS.md §8.12).
 * - Network failures (fetch throws) are NOT retried, to keep the flow simple;
 *   they become `GraphApiError(null)`.
 * - Never logs the token or request/response bodies.
 * Error codes: https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes
 */
export class GraphClient {
  private readonly accessToken: string;
  private readonly baseUrl: string;
  private readonly fetchFunction: typeof fetch;
  private readonly retryDelayMs: number;

  constructor(options: GraphClientOptions) {
    this.accessToken = options.accessToken;
    this.baseUrl = `${GRAPH_API_BASE_URL}/${options.apiVersion}`;
    this.fetchFunction = options.fetchFunction ?? fetch;
    this.retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  }

  /**
   * POSTs a JSON body to `path` (e.g. `/123/messages`) and returns the parsed
   * JSON response as `unknown` — callers validate it with Zod.
   */
  async post(path: string, body: unknown): Promise<unknown> {
    const url = `${this.baseUrl}${path}`;
    const requestBody = JSON.stringify(body);

    for (let attempt = 0; ; attempt++) {
      const response = await this.sendRequest(url, requestBody);

      if (response.ok) {
        return response.json();
      }

      const canRetry = isRetryableStatus(response.status) && attempt < MAX_RETRIES;
      if (!canRetry) {
        throw await toGraphApiError(response);
      }

      await wait(this.retryDelayMs * 2 ** attempt);
    }
  }

  private async sendRequest(url: string, requestBody: string): Promise<Response> {
    try {
      return await this.fetchFunction(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: requestBody,
      });
    } catch {
      throw new GraphApiError(null);
    }
  }
}

function isRetryableStatus(status: number): boolean {
  return status === TOO_MANY_REQUESTS_STATUS || status >= FIRST_SERVER_ERROR_STATUS;
}

async function toGraphApiError(response: Response): Promise<GraphApiError> {
  const metaErrorCode = await readMetaErrorCode(response);
  return new GraphApiError(metaErrorCode, response.status);
}

async function readMetaErrorCode(response: Response): Promise<number | null> {
  let parsedBody: unknown;
  try {
    parsedBody = await response.json();
  } catch {
    return null;
  }

  const result = graphErrorBodySchema.safeParse(parsedBody);
  if (!result.success) {
    return null;
  }
  return result.data.error.code;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
