import { describe, expect, it, vi } from "vitest";

import { GraphApiError } from "@/shared/whatsapp/graph-api-error";
import { GraphClient } from "@/shared/whatsapp/graph-client";

const ACCESS_TOKEN = "test-access-token";
const API_VERSION = "v23.0";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function metaErrorBody(code: number): unknown {
  return {
    error: {
      message: "Recipient phone number not in allowed list",
      type: "OAuthException",
      code,
      error_data: { details: "Recipient phone number not in allowed list" },
      fbtrace_id: "trace-id",
    },
  };
}

function createClient(fetchFunction: typeof fetch): GraphClient {
  return new GraphClient({
    accessToken: ACCESS_TOKEN,
    apiVersion: API_VERSION,
    fetchFunction,
    retryDelayMs: 0,
  });
}

describe("GraphClient.post", () => {
  it("sends a JSON POST with the bearer token to the configured API version", async () => {
    const fetchFunction = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(200, { ok: true }));
    const client = createClient(fetchFunction);

    const result = await client.post("/123/messages", { text: "hola" });

    expect(result).toEqual({ ok: true });
    const [url, init] = fetchFunction.mock.calls[0];
    expect(url).toBe(`https://graph.facebook.com/${API_VERSION}/123/messages`);
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    });
    expect(JSON.parse(String(init?.body))).toEqual({ text: "hola" });
  });

  it("retries after 429 and 500 responses and returns the later success", async () => {
    const fetchFunction = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(429, metaErrorBody(130429)))
      .mockResolvedValueOnce(jsonResponse(500, metaErrorBody(1)))
      .mockResolvedValueOnce(jsonResponse(200, { messages: [{ id: "wamid.1" }] }));
    const client = createClient(fetchFunction);

    const result = await client.post("/123/messages", {});

    expect(result).toEqual({ messages: [{ id: "wamid.1" }] });
    expect(fetchFunction).toHaveBeenCalledTimes(3);
  });

  it("gives up after the maximum number of retries", async () => {
    const fetchFunction = vi.fn<typeof fetch>().mockImplementation(async () => jsonResponse(503, metaErrorBody(2)));
    const client = createClient(fetchFunction);

    const error = await client.post("/123/messages", {}).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(GraphApiError);
    expect((error as GraphApiError).httpStatus).toBe(503);
    expect(fetchFunction).toHaveBeenCalledTimes(3);
  });

  it("does not retry a 400 response and maps the Meta error code", async () => {
    const fetchFunction = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(400, metaErrorBody(131030)));
    const client = createClient(fetchFunction);

    const error = await client.post("/123/messages", {}).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(GraphApiError);
    expect((error as GraphApiError).code).toBe("GRAPH_API_ERROR");
    expect((error as GraphApiError).metaErrorCode).toBe(131030);
    expect((error as GraphApiError).httpStatus).toBe(400);
    expect(fetchFunction).toHaveBeenCalledTimes(1);
  });

  it("uses a null Meta error code when the error body is not JSON", async () => {
    const fetchFunction = vi.fn<typeof fetch>().mockResolvedValue(new Response("Bad Request", { status: 400 }));
    const client = createClient(fetchFunction);

    const error = await client.post("/123/messages", {}).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(GraphApiError);
    expect((error as GraphApiError).metaErrorCode).toBeNull();
  });

  it("throws GraphApiError with a null code when the network request fails", async () => {
    const fetchFunction = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("fetch failed"));
    const client = createClient(fetchFunction);

    const error = await client.post("/123/messages", {}).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(GraphApiError);
    expect((error as GraphApiError).metaErrorCode).toBeNull();
    expect((error as GraphApiError).httpStatus).toBeNull();
    expect(fetchFunction).toHaveBeenCalledTimes(1);
  });
});
