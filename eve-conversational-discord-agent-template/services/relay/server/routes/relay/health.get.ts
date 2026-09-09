import { defineEventHandler } from "nitro/h3";
import type { RelayStatus } from "../../../types";
import { gatewayRunMs } from "../../../workflows/discord-relay";

export default defineEventHandler((): RelayStatus => ({
  configured: Boolean(
    process.env.DISCORD_CONNECTOR && process.env.RELAY_FORWARD_SECRET,
  ),
  forwardAuthConfigured: Boolean(process.env.RELAY_FORWARD_SECRET),
  environment: process.env.VERCEL_ENV ?? "development",
  gatewayRunMs: gatewayRunMs(),
}));
