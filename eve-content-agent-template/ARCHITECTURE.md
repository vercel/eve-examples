# ARCHITECTURE.md

A map of how this agent is put together, for humans and AI agents working in the repo. Keep
it current as the codebase evolves.

## Project identification

- **Name:** Content Agent (eve content assistant template)
- **Maintainer:** Vercel Labs
- **License:** Apache-2.0
- **Last updated:** 2026-06-26

## Overview

A Slack-based content assistant built on the [eve](https://eve.dev) agent framework.
Writers talk to it in Slack; it loads a per-surface style skill, reads source material from
Notion, drafts in the house voice, and writes approved pieces back to Notion as the
signed-in writer. Generated files and assets live in Vercel Blob. The agent runs on Vercel,
the same way locally (`eve dev`) and in production (`eve deploy`).

eve discovers every capability from the filesystem under `agent/`. There is no central
registry or wiring file: a tool's name is its filename, a connection's name is its filename,
and so on.

## Project structure

```text
agent/
  agent.ts                  # model configuration (defineAgent)
  instructions.md           # base system prompt / behavior
  channels/
    slack.ts                # Slack surface; credentials via Vercel Connect
  connections/
    notion.ts               # Notion MCP server, user-scoped OAuth; page creation approval-gated
  sandbox.ts                # sandbox backend (Vercel Sandbox)
  subagents/
    researcher/             # agent.ts + instructions.md; fresh-context web researcher (web tools only)
    reviewer/               # agent.ts + instructions.md + tools/get_surface_rubric.ts + lib/rubric.generated.ts
  tools/
    lint_against_style.ts   # banned-words check against the active surface's skill
    upload_asset.ts         # Vercel Blob: store text/binary
    list_assets.ts          # Vercel Blob: browse
    get_asset_info.ts       # Vercel Blob: metadata
    download_asset.ts       # Vercel Blob: read back (Blob URLs only)
    delete_asset.ts         # Vercel Blob: delete (approval-gated)
    get_writer_preferences.ts   # Blob: load this writer's saved preferences
    save_writer_preferences.ts  # Blob: save standing preferences (principal-scoped)
    clear_writer_preferences.ts # Blob: clear this writer's preferences (approval-gated)
  lib/
    writer-preferences.ts   # principal-scoped Blob key + reserved-prefix guard (shared helper)
    surfaces.generated.ts   # generated shared SURFACES enum (skill folders are the source of truth)
  skills/                   # one style skill per surface; shared refs synced into each
    blog-style/             # SKILL.md + references/{best-practices.md, format-specs.md, banned-words.json}
    linkedin-style/         # SKILL.md + references/{best-practices.md, post-specs.md, banned-words.json}
    x-style/                # SKILL.md + references/{best-practices.md, post-specs.md, banned-words.json}
    release-notes-style/    # SKILL.md + references/banned-words.json
    newsletter-style/       # "
shared-references/          # house-wide writing rules (source of truth), synced into each skill
  ai-phrases-to-avoid.md
  plain-english-alternatives.md
scripts/
  sync-shared.mjs           # syncs shared refs into skills; generates SURFACES + reviewer rubric (pnpm sync:shared)
```

## Core components

| Component | Lives in | eve primitive | Responsibility |
| --- | --- | --- | --- |
| Slack surface | `agent/channels/slack.ts` | Channel | Receives @mentions/DMs, threads replies, renders approvals as buttons |
| Agent runtime | `agent/agent.ts` + `instructions.md` | Agent | The model loop and behavior; orchestrates skills, tools, and the connection |
| Style skills | `agent/skills/<surface>-style/` | Skill | Voice/structure rules per surface (blog, LinkedIn, X, release-notes, newsletter), loaded on demand; house-wide rules synced in from `shared-references/` |
| Style lint | `agent/tools/lint_against_style.ts` | Tool | Deterministic banned-words check, reads the skill's `banned-words.json` |
| Notion access | `agent/connections/notion.ts` | Connection (MCP) | Search/read/write Notion as the signed-in writer; page creation (`notion-create-pages`) is approval-gated |
| Asset tools | `agent/tools/{upload,list,get_asset_info,download,delete}_asset.ts` | Tools | Store and manage files in Vercel Blob |
| Writer preferences | `agent/tools/{get,save,clear}_writer_preferences.ts` + `agent/lib/writer-preferences.ts` | Tools | Per-writer standing style preferences in Blob, keyed to the resolved principal (never model input) |
| Researcher subagent | `agent/subagents/researcher/` | Subagent | Fresh-context web research for facts Notion doesn't cover; uses framework `web_search`/`web_fetch`, returns cited findings + gaps |
| Reviewer subagent | `agent/subagents/reviewer/` | Subagent | Fresh-context, verdict-only review of a finished draft; pulls the surface rubric itself via its `get_surface_rubric` tool (a generated bundle), so the root passes only the surface and draft |

Channels and the connection are I/O boundaries. Tools run in the app runtime (full
`process.env`). Skills only add instructions to context; they are not an execution surface. The
`researcher` and `reviewer` subagents each run in their own isolated child session — fresh
context, none of the root's skills or connections — so the root passes what each needs in the call
`message`. The reviewer is sent only the surface and draft; it loads the rubric itself through its
own `get_surface_rubric` tool.

## Data stores

- **Notion** (external, user-owned): the source material and the destination **Drafts**
  database. The agent never holds a shared Notion credential; it acts as each writer via
  their own OAuth token.
- **Vercel Blob**: object storage for exported drafts, images, and attachments. Authenticated
  by the project's OIDC token (no `BLOB_READ_WRITE_TOKEN`). Also holds per-writer style
  preferences under the reserved `writer-preferences/<hashed-principal>.md` prefix, reachable
  only through the principal-scoped preference tools.
- **Vercel Sandbox** (`/workspace/skills/...`): holds the seeded skill files the lint tool and
  model read. Not a durable application data store.

There is no application database.

## External integrations

| Integration | Purpose | Method |
| --- | --- | --- |
| Slack | Chat surface (inbound events + outbound messages) | Vercel Connect connector (`SLACK_CONNECTOR`), webhook trigger at `/eve/v1/slack` |
| Notion (MCP) | Read source material, write drafts | MCP connection with user-scoped OAuth via Vercel Connect (`NOTION_CONNECTOR`) |
| Vercel Blob | File/asset storage | `@vercel/blob`, OIDC-authenticated |
| Vercel AI Gateway | Model access | Gateway model id (`anthropic/claude-opus-4.8`) resolved through the linked project |
| Vercel Sandbox | Isolated runtime that holds seeded skill files | `agent/sandbox.ts` (`vercelSandboxBackend`) |

## Deployment & infrastructure

- **Platform:** Vercel. Deploy with `eve deploy` (wraps `vercel deploy --prod`); the raw
  `vercel deploy` cannot auto-detect the eve framework.
- **Connectors:** provisioned via the Deploy button or `vercel connect create` + `attach`;
  the Slack trigger must point at `/eve/v1/slack`.
- **Environment:** `SLACK_CONNECTOR` and `NOTION_CONNECTOR` (connector UIDs) in the Vercel
  project; the model and Blob authenticate via the project's OIDC token.
- **Local development:** `pnpm dev` runs the same runtime in a TUI; `vercel env pull`
  supplies a short-lived OIDC token. The Slack surface only runs against a deployment.

## Security considerations

- **Inbound route auth** (`agent/channels/`): the framework default `[localDev(),
  vercelOidc()]` rejects public browser traffic; Slack traffic is authenticated by its
  connector. Slack's `defaultSlackAuth` issues a per-user (`principalType: "user"`)
  principal.
- **Outbound auth:** Notion is per-writer OAuth via Vercel Connect (token resolved per call,
  never exposed to the model); Blob uses the project OIDC token. No API keys live in code,
  and `.env*` is gitignored.
- **Human-in-the-loop:** irreversible tool actions (`delete_asset`, `clear_writer_preferences`)
  are gated with `approval` from `eve/tools/approval`, and the Notion connection gates page
  creation (`notion-create-pages`) with a per-connection `approval` policy. Each renders as a
  Slack approve/deny button.
- **Input hardening:** `lint_against_style` escapes banned words before building a `RegExp`
  (prevents ReDoS) and bounds input length; `download_asset` only fetches
  `*.blob.vercel-storage.com` URLs (prevents SSRF).
- **Per-writer isolation:** writer-preference tools derive their Blob key from the resolved
  principal (`ctx.session.auth.current`), never from model input, so a session can only touch
  its own writer's file; the general asset tools refuse the reserved `writer-preferences/`
  prefix so they can't be used as a side channel. The Blob store is provisioned public, so
  preferences are scoped, not strongly confidential — use a private store if that matters.

## Development & testing

- **Runtime/TUI:** `pnpm dev` (eve dev TUI; `/model` links a provider).
- **Type checking:** `pnpm typecheck` (tsc).
- **Lint/format:** `pnpm check` / `pnpm fix` (Ultracite, a Biome preset; config in
  `biome.jsonc`).
- **Discovery diagnostics:** `npx eve info` (must report 0 errors / 0 warnings).
- There is no unit-test suite; verify behavior in the dev TUI.

## Future considerations

- Richer Markdown to Notion block conversion (headings, lists, code) beyond paragraph splits.
- Optional asset tools not yet included: `copy_asset` and bulk `delete_assets`.
- Extending the Notion write gate: `notion-create-pages` is already approval-gated at the
  connection level; add `notion-update-page` / `notion-update-database` to
  `APPROVAL_REQUIRED_TOOLS` if edits should confirm too. Notion's MCP server exposes no delete
  tool, so deletions happen in the Notion UI.

## Glossary

- **eve:** the agent framework powering this app; discovers capabilities from `agent/`.
- **Channel:** an inbound/outbound surface (here, Slack).
- **Connection:** an external server (MCP/OpenAPI) exposed to the model; tools are called as
  `connection__<name>__<tool>`.
- **Tool:** a typed action authored with `defineTool`, run in the app runtime.
- **Skill:** a load-on-demand Markdown procedure; the packaged form requires `description`
  frontmatter used for routing.
- **Subagent:** a declared agent under `agent/subagents/<id>/` that the root delegates to as a
  tool. It runs in its own fresh child session and inherits none of the root's skills,
  connections, or tools, so the root passes context in the call `message`. Here: `researcher`
  (web research) and `reviewer` (draft review).
- **Surface:** a content type with its own style skill (blog, LinkedIn, X, release-notes,
  newsletter).
- **Shared references:** house-wide writing rules in `shared-references/` (the source of
  truth). `scripts/sync-shared.mjs` (`pnpm sync:shared`, also run on `predev`/`prebuild`) copies
  them into every skill's `references/` and regenerates the managed `## Shared references` section
  in each `SKILL.md`; the skill's own `## References` section is preserved. The same script also
  generates `agent/lib/surfaces.generated.ts` (the shared `SURFACES` enum) and the reviewer's
  rubric module. Edit the source, never the synced copies or generated files.
- **Vercel Connect:** brokers OAuth/credentials for Slack and Notion; connectors are
  identified by a UID.
- **OIDC:** the project's Vercel identity token, used to authenticate Blob (and AI Gateway)
  without static keys.
