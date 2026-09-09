import { getTokenResponse } from "@vercel/connect";
import { createHook, FatalError, sleep } from "workflow";
import { start } from "workflow/api";
import WebSocket from "ws";
import type { GatewayCheckpoint, GatewayStepResult } from "../types";
import { submitDiscordMessage } from "../server/utils/eve-delivery";

export const RELAY_OWNER_TOKEN = "discord-gateway-relay:owner";
const DEFAULT_RUN_MS = 600_000;
const MAX_RUN_MS = 720_000;
const MAX_SESSIONS_PER_RUN = 6;
const MAX_PENDING_DELIVERIES = 100;
const BASE_IDENTIFY_INTENTS = 1 | 512 | 4096;
const FATAL_CLOSE_CODES = new Set([4004, 4010, 4011, 4012, 4013, 4014]);
const CLEAR_SESSION_CLOSE_CODES = new Set([4007, 4009]);

export async function discordRelayWorkflow(initial: GatewayCheckpoint = {}) {
  "use workflow";

  let checkpoint = initial;
  let sessions = 0;

  {
    using owner = createHook({ token: RELAY_OWNER_TOKEN });
    const conflict = await owner.getConflict();
    if (conflict) return { status: "duplicate" as const, ownerRunId: conflict.runId };

    while (sessions < MAX_SESSIONS_PER_RUN) {
      const result = await runGatewaySession(checkpoint);
      checkpoint = checkpointFrom(result);
      sessions += 1;

      if (result.outcome === "not-configured") await sleep("1m");
      else if (result.outcome === "invalid-session") {
        await sleep(`${result.retryAfterMs ?? 5_000}ms`);
      } else if (result.outcome !== "completed") await sleep("5s");
    }
  }

  const continuedAs = await continueOnLatest(checkpoint);
  return { status: "continued" as const, continuedAs, checkpoint };
}

export function gatewayRunMs(): number {
  const configured = Number(process.env.RELAY_RUN_MS ?? DEFAULT_RUN_MS);
  if (!Number.isFinite(configured)) return DEFAULT_RUN_MS;
  return Math.max(30_000, Math.min(configured, MAX_RUN_MS));
}

function checkpointFrom(result: GatewayStepResult): GatewayCheckpoint {
  return {
    ...(result.sequence === undefined ? {} : { sequence: result.sequence }),
    ...(result.sessionId === undefined ? {} : { sessionId: result.sessionId }),
    ...(result.resumeGatewayUrl === undefined
      ? {}
      : { resumeGatewayUrl: result.resumeGatewayUrl }),
  };
}

async function continueOnLatest(checkpoint: GatewayCheckpoint): Promise<string> {
  "use step";

  const run = await start(discordRelayWorkflow, [checkpoint], { deploymentId: "latest" });
  return run.runId;
}

async function runGatewaySession(checkpoint: GatewayCheckpoint): Promise<GatewayStepResult> {
  "use step";

  const connectorId = process.env.DISCORD_CONNECTOR;
  if (!connectorId) {
    console.warn("DISCORD_CONNECTOR is required; the relay is parked.");
    return { outcome: "not-configured", forwarded: 0, ...checkpoint };
  }
  if (!process.env.RELAY_FORWARD_SECRET) {
    throw new FatalError("RELAY_FORWARD_SECRET is required");
  }
  if (!process.env.EVE_SERVICE_URL) {
    throw new FatalError("EVE_SERVICE_URL binding is unavailable");
  }
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") {
    throw new FatalError("Discord Gateway ownership is enabled only in production.");
  }

  const token = await resolveDiscordBotToken(connectorId);
  const url = gatewayUrl(checkpoint.resumeGatewayUrl);

  return await new Promise<GatewayStepResult>((resolve, reject) => {
    const socket = new WebSocket(url);
    let sessionId = checkpoint.sessionId;
    let resumeGatewayUrl = checkpoint.resumeGatewayUrl;
    let receivedSequence = checkpoint.sequence;
    let committedSequence = checkpoint.sequence;
    let forwarded = 0;
    let lastEventAt: string | undefined;
    let pendingDeliveries = 0;
    let heartbeatOutstanding = false;
    let heartbeatTimer: NodeJS.Timeout | undefined;
    let firstHeartbeatTimer: NodeJS.Timeout | undefined;
    let stopTimer: NodeJS.Timeout | undefined;
    let settled = false;
    let deliveryFailed = false;
    let deliveryTail = Promise.resolve();

    const result = (
      outcome: GatewayStepResult["outcome"],
      extra: Pick<GatewayStepResult, "closeCode" | "closeReason" | "retryAfterMs"> = {},
    ): GatewayStepResult => ({
      outcome,
      forwarded,
      ...(committedSequence === undefined ? {} : { sequence: committedSequence }),
      ...(sessionId === undefined ? {} : { sessionId }),
      ...(resumeGatewayUrl === undefined ? {} : { resumeGatewayUrl }),
      ...(lastEventAt === undefined ? {} : { lastEventAt }),
      ...extra,
    });

    const cleanUp = (reason: string) => {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (firstHeartbeatTimer) clearTimeout(firstHeartbeatTimer);
      if (stopTimer) clearTimeout(stopTimer);
      if (socket.readyState === WebSocket.OPEN) socket.close(1000, reason);
    };

    const settle = (
      outcome: GatewayStepResult["outcome"],
      extra?: Pick<GatewayStepResult, "closeCode" | "closeReason" | "retryAfterMs">,
    ) => {
      if (settled) return;
      settled = true;
      cleanUp(outcome === "completed" ? "bounded relay handoff" : outcome);
      void deliveryTail.then(
        () => resolve(result(outcome, extra)),
        reject,
      );
    };

    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanUp("relay failure");
      reject(error);
    };

    const queueDispatch = (payload: DiscordGatewayPayload) => {
      if (payload.s == null || settled) return;
      if (pendingDeliveries >= MAX_PENDING_DELIVERIES) {
        console.warn(JSON.stringify({ event: "delivery_backpressure", pendingDeliveries }));
        settle("delivery-backpressure", { closeReason: "delivery_backpressure" });
        return;
      }

      pendingDeliveries += 1;
      deliveryTail = deliveryTail
        .then(async () => {
          if (deliveryFailed) return;
          if (payload.t === "MESSAGE_CREATE") {
            await submitDiscordMessage({
              connectorId,
              data: payload.d,
              sequence: payload.s,
            });
            forwarded += 1;
            lastEventAt = new Date().toISOString();
          }
          committedSequence = Math.max(committedSequence ?? payload.s!, payload.s!);
        })
        .catch((error: unknown) => {
          deliveryFailed = true;
          if (error instanceof FatalError) {
            fail(error);
            return;
          }
          console.error(JSON.stringify({
            event: "delivery_failed",
            error: error instanceof Error ? error.message : String(error),
            sequence: payload.s,
          }));
          settle("delivery-failed", { closeReason: "eve_delivery_failed" });
        })
        .finally(() => {
          pendingDeliveries -= 1;
        });
    };

    const heartbeat = () => {
      if (socket.readyState !== WebSocket.OPEN) return;
      heartbeatOutstanding = true;
      socket.send(JSON.stringify({ op: 1, d: receivedSequence ?? null }));
    };

    stopTimer = setTimeout(() => settle("completed"), gatewayRunMs());
    socket.once("error", fail);
    socket.on("close", (code, reasonBuffer) => {
      if (settled) return;
      const reason = reasonBuffer.toString();
      if (FATAL_CLOSE_CODES.has(code)) {
        fail(new FatalError(`Discord Gateway rejected the connection (${code}): ${reason}`));
        return;
      }
      if (CLEAR_SESSION_CLOSE_CODES.has(code)) {
        sessionId = undefined;
        resumeGatewayUrl = undefined;
        receivedSequence = undefined;
        committedSequence = undefined;
      }
      settle("closed", { closeCode: code, closeReason: reason });
    });

    socket.on("message", (raw) => {
      if (settled) return;
      let payload: DiscordGatewayPayload;
      try {
        payload = JSON.parse(raw.toString()) as DiscordGatewayPayload;
      } catch (error) {
        fail(error);
        return;
      }

      if (payload.s != null) receivedSequence = payload.s;

      switch (payload.op) {
        case 10: {
          const interval = Number(readRecord(payload.d)?.heartbeat_interval);
          if (!Number.isFinite(interval) || interval <= 0) {
            fail(new Error("Discord Gateway supplied an invalid heartbeat interval"));
            return;
          }
          firstHeartbeatTimer = setTimeout(() => {
            heartbeat();
            heartbeatTimer = setInterval(() => {
              if (heartbeatOutstanding) {
                settle("closed", { closeReason: "heartbeat_not_acknowledged" });
                return;
              }
              heartbeat();
            }, interval);
          }, Math.random() * interval);
          identifyOrResume(socket, token, {
            sequence: receivedSequence,
            sessionId,
            resumeGatewayUrl,
          });
          return;
        }
        case 11:
          heartbeatOutstanding = false;
          return;
        case 1:
          heartbeat();
          return;
        case 7:
          settle("reconnect");
          return;
        case 9: {
          const resumable = payload.d === true;
          if (!resumable) {
            sessionId = undefined;
            resumeGatewayUrl = undefined;
            receivedSequence = undefined;
            committedSequence = undefined;
          }
          settle("invalid-session", {
            retryAfterMs: 1_000 + Math.floor(Math.random() * 4_000),
          });
          return;
        }
      }

      if (payload.t === "READY") {
        const ready = readRecord(payload.d);
        sessionId = readString(ready?.session_id);
        resumeGatewayUrl = readString(ready?.resume_gateway_url);
        console.log(JSON.stringify({ event: "gateway_ready", sessionId }));
      } else if (payload.t === "RESUMED") {
        console.log(JSON.stringify({ event: "gateway_resumed", sequence: receivedSequence }));
      }

      queueDispatch(payload);
    });
  });
}
runGatewaySession.maxRetries = 3;

function identifyOrResume(socket: WebSocket, token: string, state: GatewayCheckpoint) {
  if (state.sessionId && state.sequence != null) {
    socket.send(JSON.stringify({
      op: 6,
      d: { token, session_id: state.sessionId, seq: state.sequence },
    }));
    return;
  }

  socket.send(JSON.stringify({
    op: 2,
    d: {
      token,
      intents:
        BASE_IDENTIFY_INTENTS |
        (process.env.DISCORD_MESSAGE_CONTENT_INTENT === "true" ? 32768 : 0),
      properties: {
        os: process.platform,
        browser: "vercel-discord-relay",
        device: "vercel-discord-relay",
      },
    },
  }));
}

async function resolveDiscordBotToken(connectorId: string): Promise<string> {
  const response = await getTokenResponse(connectorId, { subject: { type: "app" } });
  return response.token;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;
}

function gatewayUrl(resumeGatewayUrl?: string): string {
  const url = new URL(resumeGatewayUrl ?? "wss://gateway.discord.gg/");
  url.searchParams.set("v", "10");
  url.searchParams.set("encoding", "json");
  return url.href;
}

interface DiscordGatewayPayload {
  readonly op: number;
  readonly d: unknown;
  readonly s?: number | null;
  readonly t?: string | null;
}
