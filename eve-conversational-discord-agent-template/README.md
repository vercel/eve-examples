# eve Conversational Discord Agent Template

A conversational Discord agent template for [eve](https://eve.dev). Users can talk to the agent naturally in DMs, mention it in a server, continue a conversation by replying, or use slash commands and Discord interactions.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?connect=%5B%7B%22type%22%3A%22discord%22%2C%22env%22%3A%22DISCORD_CONNECTOR%22%2C%22triggers%22%3Atrue%2C%22triggerPath%22%3A%22%2Feve%2Fv1%2Fdiscord%22%7D%5D&demo-description=A+conversational+Discord+agent+for+DMs%2C+mentions%2C+replies%2C+and+slash+commands%2C+built+with+eve.&demo-title=eve+Conversational+Discord+Agent&env=CRON_SECRET&env=RELAY_FORWARD_SECRET&envDescription=Generate+separate+random+values+for+the+Discord+listener+and+message+delivery.&project-name=eve+Conversational+Discord+Agent&repository-name=eve-conversational-discord-agent&repository-url=https%3A%2F%2Fgithub.com%2Fvercel%2Feve-examples%2Ftree%2Fmain%2Feve-conversational-discord-agent-template)

> [!WARNING]
> Conversational message support is experimental and intended as a starting point for prototypes and small bots. Review the [reliability boundary](#reliability-boundary) before using it in production.

## What Is Included

- Natural conversations in Discord DMs
- Server conversations started with an `@mention`
- Follow-up messages sent as replies to the agent's current response
- Slash commands, components, and modals through the native eve Discord channel
- Durable eve sessions and Discord REST API responses
- An editable Vercel-hosted listener for ordinary Discord messages

## How It Works

```text
Discord Gateway
      |
      | bounded outbound WebSocket
      v
relay service / Vercel Workflow
      |
      | authenticated private service request
      v
eve service /eve/v1/discord/gateway
      |
      v
Discord REST API replies
```

The project contains two [Vercel Services](https://vercel.com/docs/services):

- `services/eve` runs the agent, handles Discord interactions and messages through one native channel, and sends replies.
- `services/relay` implements the bounded Discord Gateway listener used for ordinary messages.

Vercel Cron reconciles the relay every five minutes. Each Workflow step holds the socket for up to ten minutes, commits a safe Discord Resume checkpoint, and hands off to another bounded step. Gateway control frames are handled immediately while message delivery proceeds through one ordered lane.

## Getting Started

Install dependencies:

```bash
pnpm install
```

Link the project and create the Discord connector:

```bash
vercel link
cd services/eve
pnpm exec eve add channel/discord
```

Copy the connector UID printed by setup into the Vercel project's production `DISCORD_CONNECTOR` environment variable. Both services use the same connector.

Generate independent secrets for the cron supervisor and relay delivery:

```bash
openssl rand -hex 32 # CRON_SECRET
openssl rand -hex 32 # RELAY_FORWARD_SECRET
```

Add both values to the Vercel project's production environment, then deploy from the project root:

```bash
vercel deploy --prod
```

Vercel Cron starts the relay within five minutes. To start it immediately:

```bash
curl -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://<deployment>/relay/start
```

## Discord Configuration

In Discord's Developer Portal, enable these Gateway intents:

- Guilds
- Guild Messages
- Direct Messages
- Message Content when reading arbitrary or mention-free guild content

The installation should grant View Channels, Send Messages, Read Message History, and Send Messages in Threads. Reinstall the application after changing its permissions.

## Conversation Behavior

- Every non-bot DM starts or resumes one conversation identified by its DM channel.
- An explicit bot mention in a guild starts a new message-anchored conversation.
- A reply to the current bot response resumes that conversation.
- Unknown or stale replies are retried briefly, then rejected rather than creating a second session.
- Other guild messages, including mention-free follow-ups in existing Discord threads, are currently ignored.
- Bot-authored messages are ignored.

The native channel currently recognizes thread identity only when Discord includes `message.thread` on the event. Ordinary messages inside an existing thread generally identify the containing thread through `channel_id`, so persistent mention-free thread conversations are not yet supported by this template.

## Environment Variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DISCORD_CONNECTOR` | Yes | Discord connector UID used for credentials and stable conversation identity. |
| `CRON_SECRET` | Yes | Secures the cron supervisor and, by default, manual relay starts. |
| `RELAY_FORWARD_SECRET` | Yes | Signs relay requests sent to the eve service. |
| `DISCORD_MESSAGE_CONTENT_INTENT` | No | Set to `true` only after enabling Discord's privileged Message Content intent. |
| `RELAY_SECRET` | No | Optional separate bearer secret for manual `POST /relay/start` calls. |
| `RELAY_RUN_MS` | No | Gateway step duration in milliseconds. Defaults to `600000` and is capped at `720000`. |

Only production deployments run the Discord message listener. Preview deployments build both services but do not connect to Discord's Gateway.

## Customize the Agent

Edit `services/eve/agent/agent.ts` to change the model and runtime configuration. The agent's behavior is defined in `services/eve/agent/instructions.md`.

The Gateway lifecycle, delivery retry policy, and supervision behavior are intentionally kept in editable source under `services/relay/`.

## Reliability Boundary

- Function WebSockets close at the Function duration limit; planned Resume boundaries are expected.
- Workflow steps are at least once. A crash can briefly leave an ambiguous old socket while the step retries.
- The Resume checkpoint advances only after preceding Discord dispatches are accepted or ignored by eve.
- Eve delivery completes only on `200` or `202`. `409`, `429`, and `5xx` responses retry before reconnecting from the last safe checkpoint; other non-success responses fail as contract or configuration errors.
- The relay sends a stable `Idempotency-Key`, but eve does not yet enforce it durably. A lost success response can still produce a duplicate turn.
- The Workflow owner hook converges normal starts on one run, but it is not a general distributed fencing service.
- The template does not implement sharding, missed-message backfill, or continuously persisted Gateway sequence state.

For strict singleton fencing and durable event deduplication, add a conditional-write datastore or move Gateway ownership into a dedicated managed service.

## Validate Locally

```bash
pnpm typecheck
pnpm build
```

## Learn More

- [eve documentation](https://eve.dev/docs)
- [Discord Gateway documentation](https://docs.discord.com/developers/events/gateway)
- [Vercel Workflow](https://vercel.com/docs/workflows)
- [Vercel Services](https://vercel.com/docs/services)
- [Vercel Connect](https://vercel.com/docs/connect)
