import { getHeader, setResponseStatus, defineEventHandler } from "nitro/h3";
import { start } from "workflow/api";
import { getRelayOwnerRunId } from "../../utils/relay-owner";
import { discordRelayWorkflow } from "../../../workflows/discord-relay";

export default defineEventHandler(async (event) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || getHeader(event, "authorization") !== `Bearer ${secret}`) {
    setResponseStatus(event, 401);
    return { error: "unauthorized" };
  }

  if (process.env.VERCEL_ENV !== "production") {
    return { started: false, reason: "production_only" };
  }
  if (!process.env.DISCORD_CONNECTOR) {
    return { started: false, reason: "discord_not_configured" };
  }
  if (!process.env.RELAY_FORWARD_SECRET) {
    return { started: false, reason: "relay_forward_auth_not_configured" };
  }

  const ownerRunId = await getRelayOwnerRunId();
  if (ownerRunId) return { started: false, runId: ownerRunId };

  const run = await start(discordRelayWorkflow, [], { deploymentId: "latest" });
  return { started: true, runId: run.runId };
});
