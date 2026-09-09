import { createHmac } from "node:crypto";

import { FatalError } from "workflow";

const MAX_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 10_000;

export async function submitDiscordMessage(input: {
  readonly connectorId: string;
  readonly data: unknown;
  readonly sequence?: number | null;
}): Promise<void> {
  const messageId = readString(readRecord(input.data)?.id) ?? "unknown";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await forwardToEve(input, messageId);
      if (response.status === 200 || response.status === 202) return;
      if (!isTransient(response.status)) {
        throw new FatalError(
          `eve rejected Discord message ${messageId} (${response.status}); check the relay contract and configuration`,
        );
      }
      if (attempt === MAX_ATTEMPTS) {
        throw new Error(`eve deferred Discord message ${messageId}: ${response.status}`);
      }
      console.warn(JSON.stringify({
        event: "delivery_retry",
        attempt,
        messageId,
        status: response.status,
      }));
      await delay(retryDelayMs(attempt, response.headers.get("retry-after")));
    } catch (error) {
      if (error instanceof FatalError || attempt === MAX_ATTEMPTS) throw error;
      console.warn(JSON.stringify({
        event: "delivery_retry",
        attempt,
        messageId,
        error: error instanceof Error ? error.message : String(error),
      }));
      await delay(retryDelayMs(attempt));
    }
  }
}

async function forwardToEve(
  input: { readonly connectorId: string; readonly data: unknown; readonly sequence?: number | null },
  messageId: string,
): Promise<Response> {
  const serviceUrl = process.env.EVE_SERVICE_URL;
  const secret = process.env.RELAY_FORWARD_SECRET;
  if (!serviceUrl) throw new FatalError("EVE_SERVICE_URL binding is unavailable");
  if (!secret) throw new FatalError("RELAY_FORWARD_SECRET is required");

  const body = JSON.stringify({
    connectorId: input.connectorId,
    data: input.data,
    deliveryId: `discord:${input.connectorId}:message:${messageId}`,
    event: "MESSAGE_CREATE",
    sequence: input.sequence ?? null,
    version: 1,
  });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", secret)
    .update(`v1\n${timestamp}\n${input.connectorId}\n${body}`, "utf8")
    .digest("hex");

  return await fetch(new URL("eve/v1/discord/gateway", ensureSlash(serviceUrl)), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": `discord:${input.connectorId}:message:${messageId}`,
      "x-eve-discord-connector": input.connectorId,
      "x-eve-discord-signature": `v1=${signature}`,
      "x-eve-discord-timestamp": timestamp,
    },
    body,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

function isTransient(status: number): boolean {
  return status === 409 || status === 429 || status >= 500;
}

function retryDelayMs(attempt: number, retryAfter: string | null = null): number {
  const retryAfterSeconds = retryAfter === null ? Number.NaN : Number(retryAfter);
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
    return Math.min(retryAfterSeconds * 1_000, 5_000);
  }
  return 250 * 2 ** (attempt - 1);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;
}

function ensureSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}
