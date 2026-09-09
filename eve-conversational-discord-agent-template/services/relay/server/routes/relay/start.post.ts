import { getHeader, setResponseStatus, defineEventHandler } from "nitro/h3";
import { start } from "workflow/api";
import { getRelayOwnerRunId } from "../../utils/relay-owner";
import { discordRelayWorkflow } from "../../../workflows/discord-relay";

export default defineEventHandler(async (event) => {
  if (!authorized(getHeader(event, "authorization"))) {
    setResponseStatus(event, 401);
    return { error: "unauthorized" };
  }

  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") {
    setResponseStatus(event, 409);
    return { error: "production_gateway_only" };
  }
  if (!process.env.DISCORD_CONNECTOR) {
    setResponseStatus(event, 503);
    return { error: "discord_not_configured" };
  }
  if (!process.env.RELAY_FORWARD_SECRET) {
    setResponseStatus(event, 503);
    return { error: "relay_forward_auth_not_configured" };
  }

  const ownerRunId = await getRelayOwnerRunId();
  if (ownerRunId) return { started: false, runId: ownerRunId };

  const run = await start(discordRelayWorkflow, []);
  return { started: true, runId: run.runId };
});

function authorized(authorization: string | undefined): boolean {
  const secret = process.env.RELAY_SECRET ?? process.env.CRON_SECRET;
  return Boolean(secret) && authorization === `Bearer ${secret}`;
}
