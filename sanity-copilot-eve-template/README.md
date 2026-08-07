# Sanity Copilot eve Template

[![Agent Stack](https://img.shields.io/badge/Agent%20Stack-000?style=flat-square&logo=vercel&logoColor=FFF&labelColor=000&color=000)](https://vercel.com/kb/agent-stack)
[![MIT License](https://img.shields.io/badge/License-MIT-000?style=flat-square&logo=opensourceinitiative&logoColor=white&labelColor=000&color=000)](LICENSE)

A Slack-based Sanity copilot built on [eve](https://eve.dev). Team members @mention it in Slack and it manages their Sanity project: querying and editing content with GROQ, inspecting and shaping schemas, creating and editing drafts, managing releases, and drafting content pieces into Notion. Long-form drafts are shared as Notion pages.

- **Lives in Slack.** Answers @mentions and DMs, replies in threads, and renders approvals as buttons.
- **Works on your Sanity project.** Each user signs in to Sanity through Vercel Connect, so queries and edits run as the real person with their own permissions, and destructive operations (patching, publishing, deploying schemas) pause for approval before they run.
- **Drafts in Notion.** Long-form pieces are created as Notion pages through the same user-scoped OAuth flow, with page updates and moves gated on approval.
- **Stores files in Vercel Blob.** Export drafts, save images and attachments, and read them back, authenticated by the project's OIDC token.

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?project-name=sanity-copilot-eve-template&repository-name=sanity-copilot-eve-template&repository-url=https%3A%2F%2Fgithub.com%2Fvercel-labs%2Fsanity-copilot-eve-template%2Ftree%2Fmain&connect=%5B%7B%22type%22%3A%22slack%22%2C%22env%22%3A%22SLACK_CONNECTOR%22%2C%22triggers%22%3Atrue%2C%22triggerPath%22%3A%22%2Feve%2Fv1%2Fslack%22%7D%2C%7B%22type%22%3A%22sanity%22%2C%22env%22%3A%22SANITY_CONNECTOR%22%7D%2C%7B%22type%22%3A%22notion%22%2C%22env%22%3A%22NOTION_CONNECTOR%22%7D%5D&stores=%5B%7B%22type%22%3A%22blob%22%2C%22access%22%3A%22public%22%7D%5D)

Deploying with the button provisions everything the agent needs and wires it up for you:

- a **Slack** connector (sets `SLACK_CONNECTOR`, with the event trigger pointed at `/eve/v1/slack`),
- a **Sanity** connector (sets `SANITY_CONNECTOR`),
- a **Notion** connector (sets `NOTION_CONNECTOR`),
- a **Vercel Blob** store for the asset tools.

Once deployed, @mention the bot in your Slack workspace to start working on your Sanity project.

## Tech stack

| Layer | Technology |
| --- | --- |
| Agent framework | [eve](https://eve.dev) |
| Language | TypeScript (strict, ESM) |
| Chat surface | Slack, via [Vercel Connect](https://vercel.com/docs/connect) |
| Content management | Sanity (MCP), user-scoped OAuth via [Vercel Connect](https://vercel.com/docs/connect) |
| Drafting surface | Notion (MCP), user-scoped OAuth via [Vercel Connect](https://vercel.com/docs/connect) |
| File storage | [Vercel Blob](https://vercel.com/docs/vercel-blob) |
| Model access | [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) |
| Sandbox | [Vercel Sandbox](https://vercel.com/docs/sandbox) |
| Lint & format | [Ultracite](https://www.ultracite.ai/) (Biome) |

**Zero static keys.** Authentication runs entirely on [Vercel Connect](https://vercel.com/docs/connect) (Slack, Sanity, and Notion) and [Vercel OIDC](https://vercel.com/docs/oidc) (Vercel Blob and AI Gateway). There are no API keys or client secrets to manage in code or `.env` files: Sanity and Notion are authorized per user in the browser, and Blob and the model authenticate with the project's OIDC token.

## Quick start with an AI coding agent

If you're working with an AI coding agent like Claude Code or Cursor, you can use this prompt to have it help you with building your agent:

```text
I want to build a Slack agent with the eve framework, using the Sanity copilot template. Read the setup instructions at https://agent-resources.dev/sanity-copilot-eve-template.md and follow them. They will cover deploying the template, building with eve, how everything works overall, and more.
```

## What's inside

```text
agent/
  agent.ts                  # model configuration, compaction, session token limits
  instructions.md           # the agent's behavior
  channels/
    slack.ts                # Slack surface (Vercel Connect credentials)
    eve.ts                  # dev TUI surface for local development
  connections/
    sanity.ts               # Sanity MCP, user-scoped OAuth; destructive tools require approval
    notion.ts               # Notion MCP, user-scoped OAuth; page updates/moves require approval
  sandbox.ts                # Vercel Sandbox backend
  subagents/
    researcher/             # fresh-context web researcher (own session, web tools only)
    reviewer/               # fresh-context draft reviewer (own session)
      skills/writing-quality/  # its own copy of the writing-quality rubric
      sandbox.ts            # its own sandbox backend
  tools/
    upload_asset.ts         # Vercel Blob: store text or binary content
    list_assets.ts          # Vercel Blob: browse stored assets
    get_asset_info.ts       # Vercel Blob: metadata without downloading
    download_asset.ts       # Vercel Blob: read a stored file back
    delete_asset.ts         # Vercel Blob: delete (requires approval)
    get_user_preferences.ts   # load this user's saved preferences
    save_user_preferences.ts  # save standing preferences (per-user, principal-scoped)
    clear_user_preferences.ts # clear this user's preferences (requires approval)
  lib/
    user-preferences.ts     # principal-scoped Blob key + reserved-prefix guard
  skills/
    sanity-best-practices/              # schemas, GROQ, releases, framework integrations
    content-modeling-best-practices/    # designing and refactoring content types
    portable-text-conversion/           # converting rich text into Portable Text
    portable-text-serialization/        # rendering Portable Text out to other formats
    seo-aeo-best-practices/             # metadata, structured data, AI-answer readiness
    content-experimentation-best-practices/  # A/B tests and variants
    writing-quality/                    # prose rules for anything written for humans
```

All of the skills except `writing-quality` come from Sanity's [Agent Toolkit](https://github.com/sanity-io/agent-toolkit); the `sanity-best-practices` references are also the canonical content behind the Sanity MCP server's rules tools.

## Pairing with the content agent template

The [eve content agent template](https://github.com/vercel-labs/eve-content-agent-template) is a full content assistant: per-surface style skills (blog, LinkedIn, X, release notes, newsletters), a house voice, and a style lint. Instead of merging all of that into this copilot, you can deploy it as its own agent and let the copilot delegate to it through eve's [remote agents](https://eve.dev/docs/guides/remote-agents) feature.

1. Deploy the content agent template as its own Vercel project.
2. Add a remote subagent file to this repo. The filename is the tool name, and `vercelOidc()` handles deployment-to-deployment auth with no shared secret:

```ts
// agent/subagents/content_writer.ts
import { defineRemoteAgent } from "eve";
import { vercelOidc } from "eve/agents/auth";

export default defineRemoteAgent({
  url: () => process.env.CONTENT_AGENT_URL ?? "https://your-content-agent.vercel.app",
  description:
    "Drafts blog posts, LinkedIn and X posts, release notes, and newsletters in the house voice. " +
    "Pass the surface, the source material, and any constraints in the message.",
  auth: vercelOidc(),
});
```

3. Set `CONTENT_AGENT_URL` in this project's environment and mention the new subagent in `agent/instructions.md` so the copilot knows when to hand off.

The remote agent runs in its own deployment with its own skills and connections, and it never sees this copilot's conversation history, so the copilot packs everything the writer needs into the call `message`. The result comes back as a normal tool result, the same shape as the local `researcher` and `reviewer` subagents.

## Local development

Link the project you deployed (or a fresh one) and pull its environment:

```bash
vercel link
vercel env pull
```

Then run the development server and link a model provider with `/model` in the TUI:

```bash
pnpm dev
```

You can chat with the agent directly in the dev TUI to test the Sanity, Notion, and Blob flows. The Slack surface itself only runs against a deployment. Ship changes with:

```bash
eve deploy
```

### Linting and formatting

This project uses [Ultracite](https://www.ultracite.ai/) (a [Biome](https://biomejs.dev/) preset) for linting and formatting:

```bash
pnpm check      # check formatting and lint rules
pnpm fix        # auto-fix what is fixable
pnpm validate   # lint + typecheck + eve discovery diagnostics
```

### Setting up the connectors by hand

The Deploy button provisions these for you. To set them up manually (for a project you didn't create with the button), use the [Vercel CLI](https://vercel.com/docs/cli):

```bash
# Sanity connector (prints the UID sanity/copilot-agent -> SANITY_CONNECTOR)
vercel connect create sanity --name copilot-agent

# Notion connector (prints the UID notion/sanity-copilot -> NOTION_CONNECTOR)
vercel connect create notion --name sanity-copilot

# Slack connector (note the UID, e.g. slack/<name> -> SLACK_CONNECTOR), then point its
# event trigger at the route the agent serves
vercel connect create slack --name <name> --triggers
vercel connect attach slack/<name> --triggers --trigger-path /eve/v1/slack

# Blob store, connected to the project for all environments
vercel blob create-store <name> --access public --yes
```

## Customizing

- **Behavior:** edit `agent/instructions.md`. It describes the whole workflow: load the right skill first, ground work in the real project with GROQ and schema reads, work in drafts and publish only on approval, draft long pieces into Notion, and get a fresh-eyes review before proposing a draft.
- **Approval gates:** edit the `APPROVAL_REQUIRED_TOOLS` lists in `agent/connections/sanity.ts` and `agent/connections/notion.ts` to change which MCP tools pause for a human decision.
- **Skills:** edit or add skills in `agent/skills/`. Each folder holds a `SKILL.md` plus its reference files. The reviewer subagent keeps its own copy of `writing-quality` under `agent/subagents/reviewer/skills/`.
- **Model:** edit `agent/agent.ts` (or run `/model` in the dev TUI).
- **Tools:** add or change tools in `agent/tools/`. The filename is the tool name.

The agent auto-updates as you edit these files.

## Learn more

- [eve documentation](https://eve.dev/docs/introduction): the framework powering this agent.
- [Vercel Connect](https://vercel.com/docs/connect): manages the Slack, Sanity, and Notion credentials.
- [Sanity documentation](https://www.sanity.io/docs): the CMS the copilot manages.
- [Sanity Agent Toolkit](https://github.com/sanity-io/agent-toolkit): the source of every skill here except `writing-quality`.
- [Vercel Blob](https://vercel.com/docs/vercel-blob): object storage for the asset tools.

## Related templates

- [eve Content Agent](https://github.com/vercel-labs/eve-content-agent-template)
- [eve Personal Agent](https://vercel.com/templates/nuxt/eve-personal-agent)
