import { discordChannel } from "eve/channels/discord";

import { discordCredentials } from "../discord-credentials";

const connectorId = process.env.DISCORD_CONNECTOR ?? "discord/not-configured";

export default discordChannel({
  credentials: discordCredentials,
  gateway: {
    connectorId,
    secret: () => process.env.RELAY_FORWARD_SECRET ?? "",
  },
});
