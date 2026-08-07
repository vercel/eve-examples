# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project overview

A Slack-based Sanity copilot built on the [eve](https://eve.dev) agent framework. Users @mention it in Slack; it manages their Sanity project through the **Sanity** MCP connection (GROQ queries, schemas, drafts, releases), pulls source material from and drafts into **Notion** (user-scoped OAuth via Vercel Connect), and stores files in **Vercel Blob**. Its workflow lives in `agent/instructions.md`.

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
- **Identity comes from the filesystem, never a `name` field.** A tool at `agent/tools/upload_asset.ts` is the tool `upload_asset`; a connection at `agent/connections/sanity.ts` registers as `sanity`.
- Authored slots: `agent/agent.ts` (model), `agent/instructions.md` (system prompt), `agent/tools/*.ts` (`defineTool`), `agent/connections/*.ts`, `agent/channels/*.ts`, `agent/skills/<name>/SKILL.md`, `agent/subagents/<id>/agent.ts` (`defineAgent`), `agent/sandbox.ts`. This repo also has `agent/subagents/<id>/skills/` and `agent/subagents/reviewer/sandbox.ts`: subagent sandboxes don't inherit from the root, and the reviewer needs one to read its skill's reference files.
- **Tools** run in the app runtime (full `process.env`), one default export per file. Gate destructive tools with `approval` from `eve/tools/approval`. **Connections** accept the same `approval` field: both `sanity.ts` and `notion.ts` pass a policy that substring-matches the qualified tool name against an `APPROVAL_REQUIRED_TOOLS` list. Sanity gates `patch_documents`, `publish_documents`, `unpublish_documents`, `discard_drafts`, `version_discard`, `update_dataset`, `deploy_schema`, and `deploy_studio`; Notion gates `update-pages`, `move-pages`, `update-data-source`, and `update-view` (creation is ungated).
- **Skills** are load-on-demand. A packaged skill (`<name>/SKILL.md`) requires `description` frontmatter; that description is the routing hint. Skills here: `sanity-best-practices`, `content-modeling-best-practices`, `portable-text-conversion`, `portable-text-serialization`, `seo-aeo-best-practices`, `content-experimentation-best-practices`, and `writing-quality`.
- **Subagents** are declared under `agent/subagents/<id>/agent.ts` (`defineAgent`, required `description` — the routing hint). The directory name is the identity and the lowered tool name (no namespace; it must not collide with a tool name). A declared subagent runs in a fresh child session and **inherits nothing** from the root (no skills, connections, tools, or sandbox), so the caller passes everything it needs in the `message`. Here: `researcher` and `reviewer`. The reviewer carries its own copy of the `writing-quality` skill under `agent/subagents/reviewer/skills/` plus its own `sandbox.ts`. The copy intentionally diverges from the root skill where the root's references other root-only skills (`seo-aeo-best-practices`); when editing either copy, keep them in step except for that.
- After editing, **check LSP diagnostics / `pnpm typecheck`** and fix type errors before moving on.

## Code style

- Linting and formatting are handled by **Ultracite** (a Biome preset). Run `pnpm check` before finishing and `pnpm fix` to auto-fix. Config is in `biome.jsonc`; the kebab-case filename rule is disabled there because eve tools use snake_case names.
- TypeScript strict; ESM with `NodeNext` resolution (relative imports need a `.js` extension). Prefer `const`, arrow functions, optional chaining / nullish coalescing.
- Validate tool input/output with `zod` schemas.
- Document exported config with **TSDoc** (`@remarks`, `@param`, `@returns`, `@defaultValue`, `@see`). Avoid inline `//` comments — put rationale in the TSDoc block instead.
- Prose in markdown files is not hard-wrapped: write each paragraph or bullet as one line.
- Agent-facing text (instructions, skill bodies, tool and subagent descriptions) follows the "How you write" rules in `agent/instructions.md`: no em dashes, no machine-made words, no bold for emphasis. It carries behavior only, never framework plumbing (sign-in flows, how approvals render) or references to tools and skills the reading agent can't access.

## Security

- **Never ask the user for API keys, client secrets, or any other credentials.**
- **Never commit secrets.** `.env*` is gitignored. Connector UIDs are read from env (`SLACK_CONNECTOR`, `SANITY_CONNECTOR`, `NOTION_CONNECTOR`); Sanity and Notion auth is per-user via Vercel Connect and Blob auth is via the project's OIDC token — there are no API keys in code.
- If you ever build a `RegExp` from data, escape it (literal match) and bound the input length.
- Gate irreversible or high-impact actions behind `approval`: destructive tools (`delete_asset`, `clear_user_preferences`) and connection writes (the `sanity` and `notion` connections gate the write tools listed above).
- For per-user storage, derive the key from the resolved principal (`ctx.session.auth.current`), never from model input — see `agent/lib/user-preferences.ts`. The preference files live under the reserved `user-preferences/` Blob prefix, which the general asset tools refuse so they can't read or overwrite another user's file.
- `download_asset` only fetches URLs on `*.blob.vercel-storage.com`.

## Before committing

- `pnpm validate` passes (Ultracite check, `tsc`, and `eve info` with 0 errors / 0 warnings).
- No secrets, `node_modules`, or build output (`.eve`, `.vercel`, `.output`) staged.
