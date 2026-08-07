# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project overview

A Slack-based social media agent built on the [eve](https://eve.dev) agent framework. Users @mention it in Slack; it drafts, schedules, and manages social posts across X, LinkedIn, Threads, Bluesky, and Mastodon through the **Typefully** MCP connection (static API key via `TYPEFULLY_API_KEY`), pulls briefs and source material from **Notion** (user-scoped OAuth via Vercel Connect), and stores files in **Vercel Blob**. Its workflow lives in `agent/instructions.md`.

The whole agent is defined under `agent/`. eve discovers capabilities from the filesystem. See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the component map, data flow, and boundaries.

## Setup & commands

```bash
pnpm install        # install dependencies (Node 24.x)
pnpm dev            # eve dev — local TUI; run /model once to link a model provider
pnpm typecheck      # tsc (TypeScript, no emit)
pnpm check          # ultracite (Biome) lint + format check
pnpm fix            # ultracite (Biome) auto-fix
pnpm build          # eve build
eve deploy          # deploy to Vercel production (use this, not raw `vercel deploy`)
npx eve info        # print the discovered surface + discovery diagnostics
pnpm validate       # check + typecheck + eve info in one command
```

There is no unit-test suite. **Verify changes with `pnpm validate` (lint, typecheck, and discovery diagnostics must all report 0 errors / 0 warnings), then exercise the agent in the `pnpm dev` TUI.**

## eve conventions

- **Read the relevant guide in `node_modules/eve/docs/` before writing code.** Don't invent framework APIs; confirm them against the docs.
- **Identity comes from the filesystem, never a `name` field.** A tool at `agent/tools/upload_asset.ts` is the tool `upload_asset`; a connection at `agent/connections/typefully.ts` registers as `typefully`.
- Authored slots: `agent/agent.ts` (model), `agent/instructions.md` (system prompt), `agent/tools/*.ts` (`defineTool`), `agent/connections/*.ts`, `agent/channels/*.ts`, `agent/schedules/*.ts` (`defineSchedule`, root-only cron tasks), `agent/skills/<name>/SKILL.md`, `agent/subagents/<id>/agent.ts` (`defineAgent`), `agent/sandbox.ts`. This repo also has `agent/subagents/<id>/skills/` and `agent/subagents/reviewer/sandbox.ts`: subagent sandboxes don't inherit from the root, and the reviewer needs one to read its skill's reference files.
- **Tools** run in the app runtime (full `process.env`), one default export per file. Gate destructive tools with `approval` from `eve/tools/approval`. **Connections** accept the same `approval` field: both `typefully.ts` and `notion.ts` pass a policy that substring-matches the qualified tool name. Typefully always gates the delete tools (`typefully_delete_draft`, `typefully_delete_comment`, `typefully_delete_thread`) and gates `typefully_create_draft` / `typefully_edit_draft` only when `requestBody.publish_at` is set (scheduling or publishing), so plain drafting stays friction-free; Notion gates `update-pages`, `move-pages`, `update-data-source`, and `update-view` against an `APPROVAL_REQUIRED_TOOLS` list (creation is ungated).
- **Schedules** are root-only cron tasks under `agent/schedules/*.ts` (`defineSchedule`, one `cron` plus `markdown` or `run`); each becomes a Vercel Cron Job evaluated in UTC. Here: `weekly-analytics` (Mondays 14:00 UTC, task mode) prompts the agent to pull Typefully analytics and call `post_analytics_report`, which posts a posts table and a followers table as Slack `data_table` blocks (falling back to fixed-width text if the blocks are rejected) to the channel in `TYPEFULLY_ANALYTICS_CHANNEL` via `callSlackApi`. That tool's destination is env-fixed, never model input, so it can only ever post to the one analytics channel. `eve dev` does not fire schedules on their cadence; dispatch one with `curl -X POST http://localhost:3000/eve/v1/dev/schedules/<name>`.
- **Skills** are load-on-demand. A packaged skill (`<name>/SKILL.md`) requires `description` frontmatter; that description is the routing hint. Skills here: `writing-quality` (generic prose quality plus the AI-phrases and plain-English reference lists) and five platform style skills (`x-style`, `linkedin-style`, `threads-style`, `bluesky-style`, `mastodon-style`), each carrying that platform's conventions plus a `references/banned-words.json` that the `lint_against_style` tool reads at runtime via `ctx.getSkill`.
- **Subagents** are declared under `agent/subagents/<id>/agent.ts` (`defineAgent`, required `description` — the routing hint). The directory name is the identity and the lowered tool name (no namespace; it must not collide with a tool name). A declared subagent runs in a fresh child session and **inherits nothing** from the root (no skills, connections, tools, or sandbox), so the caller passes everything it needs in the `message`. Here: `researcher` and `reviewer`. The reviewer carries its own copy of the `writing-quality` skill under `agent/subagents/reviewer/skills/` plus its own `sandbox.ts`. The two copies are byte-identical, duplicated by hand; when editing either, mirror the change so they stay identical.
- After editing, **check LSP diagnostics / `pnpm typecheck`** and fix type errors before moving on.

## Code style

- Linting and formatting are handled by **Ultracite** (a Biome preset). Run `pnpm check` before finishing and `pnpm fix` to auto-fix. Config is in `biome.jsonc`; the kebab-case filename rule is disabled there because eve tools use snake_case names.
- TypeScript strict; ESM with `bundler` module resolution (file extensions are optional in imports). Prefer `const`, arrow functions, optional chaining / nullish coalescing.
- Validate tool input/output with `zod` schemas.
- Document exported config with **TSDoc** (`@remarks`, `@param`, `@returns`, `@defaultValue`, `@see`). Avoid inline `//` comments — put rationale in the TSDoc block instead.
- Prose in markdown files is not hard-wrapped: write each paragraph or bullet as one line.
- Agent-facing text (instructions, skill bodies, tool and subagent descriptions) follows the "How you write" rules in `agent/instructions.md`: no em dashes, no machine-made words, no bold for emphasis. It carries behavior only, never framework plumbing (sign-in flows, how approvals render) or references to tools and skills the reading agent can't access.

## Security

- **Never ask the user for API keys, client secrets, or any other credentials.**
- **Never commit secrets.** `.env*` is gitignored. Connector UIDs are read from env (`SLACK_CONNECTOR`, `NOTION_CONNECTOR`); Typefully auth is a static API key read from the `TYPEFULLY_API_KEY` env var via `getToken`, Notion auth is per-user OAuth via Vercel Connect, and Blob auth is via the project's OIDC token. The weekly digest reads its destination channel id from `TYPEFULLY_ANALYTICS_CHANNEL` (config, not a secret). The Typefully key is the only credential to manage; it belongs in env vars, never in source files.
- If you ever build a `RegExp` from data, escape it (literal match) and bound the input length.
- Gate irreversible or high-impact actions behind `approval`: destructive tools (`delete_asset`, `clear_user_preferences`) and connection writes (the `typefully` and `notion` connections gate the tools listed above).
- For per-user storage, derive the key from the resolved principal (`ctx.session.auth.current`), never from model input — see `agent/lib/user-preferences.ts`. The preference files live under the reserved `user-preferences/` Blob prefix, which the general asset tools refuse so they can't read or overwrite another user's file.
- `download_asset` only fetches URLs on `*.blob.vercel-storage.com`.

## Before committing

- `pnpm validate` passes (Ultracite check, `tsc`, and `eve info` with 0 errors / 0 warnings).
- No secrets, `node_modules`, or build output (`.eve`, `.vercel`, `.output`) staged.
