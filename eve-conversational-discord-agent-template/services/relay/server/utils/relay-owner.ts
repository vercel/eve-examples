import { HookNotFoundError } from "workflow/errors";
import { getHookByToken } from "workflow/api";
import { RELAY_OWNER_TOKEN } from "../../workflows/discord-relay";

export async function getRelayOwnerRunId(): Promise<string | undefined> {
  try {
    const owner = await getHookByToken(RELAY_OWNER_TOKEN);
    return owner.runId;
  } catch (error) {
    if (HookNotFoundError.is(error)) return undefined;
    throw error;
  }
}
