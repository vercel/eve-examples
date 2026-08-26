import { connectDiscordCredentials } from "@vercel/connect/eve";

const connector = process.env.DISCORD_CONNECTOR ?? "discord/not-configured";

export const discordCredentials = connectDiscordCredentials(connector);
