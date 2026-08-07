# ARCHITECTURE.md

A map of how this agent is put together, for humans and AI agents working in the repo. Keep it current as the codebase evolves.

## Project identification

- **Name:** Typefully Social Media Agent (eve template)
- **Maintainer:** Vercel Labs
- **License:** MIT
- **Last updated:** 2026-07-20

## Overview

A Slack-based social media agent built on the [eve](https://eve.dev) agent framework. Users @mention it to run their social presence: drafting posts and threads, scheduling and managing the publishing queue, uploading media, and reading analytics across X, LinkedIn, Threads, Bluesky, and Mastodon, all through Typefully's MCP server as the signed-in user. Briefs and source material come from Notion, where long-form pieces are also drafted; generated files and assets live in Vercel Blob. The agent runs on Vercel, the same way locally (`eve dev`) and in production (`eve deploy`).

eve discovers every capability from the filesystem under `agent/`. There is no central registry or wiring file: a tool's name is its filename, a connection's name is its filename, and so on.

## Project structure

```text
agent/
  agent.ts                  # model configuration (defineAgent): compaction + session token limits
  instructions.md           # base system prompt / behavior
  channels/
    slack.ts                # Slack surface; credentials via Vercel Connect
    eve.ts                  # inbound route auth; dev-only localDevUser shim (user principal)
  connections/
    typefully.ts            # Typefully MCP server, static API key (TYPEFULLY_API_KEY); deletes and scheduling approval-gated
    notion.ts               # Notion MCP server, user-scoped OAuth; update/move tools approval-gated
  sandbox.ts                # sandbox backend (Vercel Sandbox)
  schedules/
    weekly-analytics.ts     # Monday cron: pull Typefully analytics, post a digest to Slack
  subagents/
    researcher/             # agent.ts + instructions.md; fresh-context web researcher (web tools only)
    reviewer/               # agent.ts + instructions.md + own skills/writing-quality copy + sandbox.ts
  tools/
    upload_asset.ts         # Vercel Blob: store text/binary
    list_assets.ts          # Vercel Blob: browse
    get_asset_info.ts       # Vercel Blob: metadata
    download_asset.ts       # Vercel Blob: read back (Blob URLs only)
    delete_asset.ts         # Vercel Blob: delete (approval-gated)
    get_user_preferences.ts   # Blob: load this user's saved preferences
    save_user_preferences.ts  # Blob: save standing preferences (principal-scoped)
    clear_user_preferences.ts # Blob: clear this user's preferences (approval-gated)
    lint_against_style.ts   # check a draft against the target platform's banned-words list
    post_analytics_report.ts  # post the weekly analytics digest to a fixed Slack channel (callSlackApi)
  lib/
    user-preferences.ts     # principal-scoped Blob key + reserved-prefix guard (shared helper)
  skills/                   # load-on-demand procedures, routed by description frontmatter
    writing-quality/              # generic prose quality: AI-tells + plain-English references
    x-style/                      # X voice, hooks, threads, specs, banned words
    linkedin-style/               # LinkedIn equivalents
    threads-style/                # Threads equivalents
    bluesky-style/                # Bluesky equivalents
    mastodon-style/               # Mastodon equivalents
```

## Core components

| Component | Lives in | eve primitive | Responsibility |
| --- | --- | --- | --- |
| Slack surface | `agent/channels/slack.ts` | Channel | Receives @mentions/DMs, threads replies, renders approvals as buttons |
| Route auth | `agent/channels/eve.ts` | Channel | Inbound auth for the eve route; the `localDevUser` shim upgrades the dev principal to a user so user-scoped connections work in the dev TUI |
| Agent runtime | `agent/agent.ts` + `instructions.md` | Agent | The model loop and behavior; orchestrates skills, tools, and the connections |
| Skills | `agent/skills/<name>/` | Skill | Task-specific guidance (per-platform social craft, writing quality), loaded on demand |
| Typefully access | `agent/connections/typefully.ts` | Connection (MCP) | List social sets, create/edit/read drafts, schedule posts, manage the queue, upload media, and read post and follower analytics; deletes always require approval, and create/edit require it only when `publish_at` is set |
| Notion access | `agent/connections/notion.ts` | Connection (MCP) | Search/read/write Notion as the signed-in user; update/move tools are approval-gated, page creation is not |
| Asset tools | `agent/tools/{upload,list,get_asset_info,download,delete}_asset.ts` | Tools | Store and manage files in Vercel Blob |
| User preferences | `agent/tools/{get,save,clear}_user_preferences.ts` + `agent/lib/user-preferences.ts` | Tools | Per-user standing preferences in Blob, keyed to the resolved principal (never model input) |
| Style lint | `agent/tools/lint_against_style.ts` | Tool | Deterministic banned-words check on a draft; reads `references/banned-words.json` from the matching `*-style` skill via `ctx.getSkill`, with the surface constrained to a fixed enum |
| Analytics digest | `agent/schedules/weekly-analytics.ts` + `agent/tools/post_analytics_report.ts` | Schedule + Tool | Monday cron runs the agent to pull Typefully post and follower analytics and post two Slack `data_table` blocks (with a fixed-width text fallback) to the channel in `TYPEFULLY_ANALYTICS_CHANNEL` via `callSlackApi`; the tool's destination is env-fixed, never model input |
| Researcher subagent | `agent/subagents/researcher/` | Subagent | Fresh-context web research for facts the source material doesn't hold; uses framework `web_search`/`web_fetch`, returns cited findings + gaps |
| Reviewer subagent | `agent/subagents/reviewer/` | Subagent | Fresh-context, verdict-only review of a finished draft; loads the rubric from its own `writing-quality` skill copy, so the root passes only the draft and context |

Channels and the connections are I/O boundaries. Tools run in the app runtime (full `process.env`). Skills only add instructions to context; they are not an execution surface. The `researcher` and `reviewer` subagents each run in their own isolated child session — fresh context, none of the root's skills or connections — so the root passes what each needs in the call `message`. The reviewer is sent only the draft and any voice or audience context; it loads the rubric itself from its own copy of the `writing-quality` skill. The two copies are byte-identical and duplicated by hand; a change to either must be mirrored to the other.

## Data stores

- **Typefully** (external, user-owned): where drafts, the publishing queue, media, tags, and analytics live. All access goes through Typefully's MCP server, authenticated with a static API key read from the `TYPEFULLY_API_KEY` environment variable — one shared workspace credential, resolved per connection attempt and never exposed to the model.
- **Notion** (external, user-owned): the source for briefs and reference material and the destination for long-form drafts. Per-user OAuth, no shared credential.
- **Vercel Blob**: object storage for exported drafts, images, and attachments. Authenticated by the project's OIDC token (no `BLOB_READ_WRITE_TOKEN`). Also holds per-user preferences under the reserved `user-preferences/<hashed-principal>.md` prefix, reachable only through the principal-scoped preference tools.
- **Vercel Sandbox** (`/workspace/skills/...`): holds the seeded skill files the model reads. The reviewer subagent declares its own `sandbox.ts` because subagent sandboxes don't inherit from the root. Not a durable application data store.

There is no application database.

## External integrations

| Integration | Purpose | Method |
| --- | --- | --- |
| Slack | Chat surface (inbound events + outbound messages) | Vercel Connect connector (`SLACK_CONNECTOR`), webhook trigger at `/eve/v1/slack` |
| Typefully (MCP) | Draft, schedule, and manage social posts and analytics | MCP connection to `mcp.typefully.com` with a static API key (`TYPEFULLY_API_KEY`, sent as a Bearer token via `getToken`) |
| Notion (MCP) | Read briefs and source material, write long-form drafts | MCP connection to `mcp.notion.com` with user-scoped OAuth via Vercel Connect (`NOTION_CONNECTOR`) |
| Vercel Blob | File/asset storage | `@vercel/blob`, OIDC-authenticated |
| Vercel AI Gateway | Model access | Gateway model ids resolved through the linked project; the root model is set in `agent/agent.ts` and each subagent sets its own in `agent/subagents/<id>/agent.ts` |
| Vercel Sandbox | Isolated runtime that holds seeded skill files | `agent/sandbox.ts` and the reviewer's own `sandbox.ts` (`vercel()` backend) |

## Deployment & infrastructure

- **Platform:** Vercel. Deploy with `eve deploy` (wraps `vercel deploy --prod`); the raw `vercel deploy` cannot auto-detect the eve framework.
- **Connectors:** provisioned via the Deploy button or `vercel connect create` + `attach`; the Slack trigger must point at `/eve/v1/slack`.
- **Environment:** `SLACK_CONNECTOR` and `NOTION_CONNECTOR` (connector UIDs), `TYPEFULLY_API_KEY` (the Typefully API key), and `TYPEFULLY_ANALYTICS_CHANNEL` (the Slack channel id the weekly digest posts to) in the Vercel project; the model and Blob authenticate via the project's OIDC token.
- **Schedules:** each `defineSchedule` under `agent/schedules/` becomes a Vercel Cron Job evaluated in UTC. `weekly-analytics` fires Mondays at 14:00 UTC; adjust the cron for your timezone. `eve dev` never fires schedules on their cadence, so trigger a run out of band with `curl -X POST http://localhost:3000/eve/v1/dev/schedules/weekly-analytics`.
- **Local development:** `pnpm dev` runs the same runtime in a TUI; `vercel env pull` supplies a short-lived OIDC token. The Slack surface only runs against a deployment.

## Security considerations

- **Inbound route auth** (`agent/channels/eve.ts`): `[localDevUser, vercelOidc()]` rejects public browser traffic; Slack traffic is authenticated by its connector, which issues a per-user (`principalType: "user"`) principal. `localDevUser` defers the trust decision to the framework's `localDev()` and only upgrades the resolved dev principal to a user, so user-scoped connections work from the dev TUI without affecting production.
- **Outbound auth:** Typefully authenticates with a static API key read from `TYPEFULLY_API_KEY` via `getToken`; Notion is per-user OAuth via Vercel Connect (credentials resolved per call, never exposed to the model); Blob uses the project OIDC token. No credentials live in code, and `.env*` is gitignored.
- **Human-in-the-loop:** irreversible tool actions (`delete_asset`, `clear_user_preferences`) are gated with `approval` from `eve/tools/approval`. The Typefully connection always gates its delete tools (`typefully_delete_draft`, `typefully_delete_comment`, `typefully_delete_thread`) and gates `typefully_create_draft` / `typefully_edit_draft` only when `requestBody.publish_at` is set, so plain drafting never prompts but scheduling and publishing do. The Notion connection gates its update/move tools (`notion-update-pages`, `notion-move-pages`, `notion-update-data-source`, `notion-update-view`). Each renders as a Slack approve/deny button.
- **Input hardening:** `download_asset` only fetches `*.blob.vercel-storage.com` URLs (prevents SSRF, since the `url` is model-supplied). The Typefully approval policy reads `requestBody.publish_at` defensively (`readPublishAt`) without trusting the model-supplied input shape.
- **Per-user isolation:** the preference tools derive their Blob key from the resolved principal (`ctx.session.auth.current`), never from model input, so a session can only touch its own user's file; the id is hashed so the stored path carries no raw identifier. The general asset tools refuse the reserved `user-preferences/` prefix so they can't be used as a side channel. The Blob store is provisioned public, so preferences are scoped, not strongly confidential — use a private store if that matters.

## Development & testing

- **Runtime/TUI:** `pnpm dev` (eve dev TUI; `/model` links a provider).
- **Type checking:** `pnpm typecheck` (tsc).
- **Lint/format:** `pnpm check` / `pnpm fix` (Ultracite, a Biome preset; config in `biome.jsonc`).
- **Discovery diagnostics:** `npx eve info` (must report 0 errors / 0 warnings).
- There is no unit-test suite; verify behavior in the dev TUI.

## Future considerations

- Gating Notion page creation: `notion-create-pages` is currently ungated because drafting into Notion is the normal flow; add it to the Notion `APPROVAL_REQUIRED_TOOLS` if creation should confirm too. Notion's MCP server exposes no delete tool, so deletions happen in the Notion UI.
- Extending `lint_against_style` beyond banned words: per-platform length checks against `post-specs.md`, or flagging AI-tell phrases from the `writing-quality` references.
- Keeping the root's and the reviewer's `writing-quality` skill copies in step; today they are byte-identical and duplicated by hand, so a change to either must be mirrored.
- Richer publishing workflows: campaign-level scheduling across several social sets, recurring queue slots, and analytics-driven follow-ups beyond the current draft-then-approve loop.

## Glossary

- **eve:** the agent framework powering this app; discovers capabilities from `agent/`.
- **Channel:** an inbound/outbound surface (here, Slack, plus the eve route's auth config).
- **Connection:** an external server (MCP/OpenAPI) exposed to the model; tools are called as `connection__<name>__<tool>`. Here: `typefully` and `notion`.
- **Tool:** a typed action authored with `defineTool`, run in the app runtime.
- **Schedule:** a cron-triggered agent run authored with `defineSchedule` under `agent/schedules/`. Here: `weekly-analytics` (the Monday Typefully analytics digest).
- **Skill:** a load-on-demand Markdown procedure; the packaged form requires `description` frontmatter used for routing. Here: `writing-quality` plus five per-platform style skills (`x-style`, `linkedin-style`, `threads-style`, `bluesky-style`, `mastodon-style`).
- **Subagent:** a declared agent under `agent/subagents/<id>/` that the root delegates to as a tool. It runs in its own fresh child session and inherits none of the root's skills, connections, or tools, so the root passes context in the call `message`. Here: `researcher` (web research) and `reviewer` (draft review, with its own skill copy and sandbox).
- **Vercel Connect:** brokers OAuth/credentials for Slack and Notion; connectors are identified by a UID.
- **OIDC:** the project's Vercel identity token, used to authenticate Blob (and AI Gateway) without static keys.
