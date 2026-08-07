# Typefully Social Media Agent eve Template

[![Agent Stack](https://img.shields.io/badge/Agent%20Stack-000?style=flat-square&logo=vercel&logoColor=FFF&labelColor=000&color=000)](https://vercel.com/kb/agent-stack)
[![MIT License](https://img.shields.io/badge/License-MIT-000?style=flat-square&logo=opensourceinitiative&logoColor=white&labelColor=000&color=000)](LICENSE)

A Slack-based social media agent built on [eve](https://eve.dev). Team members @mention it in Slack and it runs their social presence through Typefully: drafting posts and threads for X, LinkedIn, Threads, Bluesky, and Mastodon, scheduling and managing the publishing queue, uploading media, reading analytics, and pulling briefs from Notion. Long-form pieces are shared as Notion pages.

- **Lives in Slack.** Answers @mentions and DMs, replies in threads, and renders approvals as buttons.
- **Works on your Typefully account.** The connection authenticates with your Typefully API key (`TYPEFULLY_API_KEY`), so drafts and scheduling run against your real workspace. Plain drafting is friction-free; scheduling or publishing a post (`publish_at`) and deleting drafts, comments, or threads pause for approval before they run.
- **Pulls from and drafts into Notion.** Briefs and source material come from Notion pages through the same user-scoped OAuth flow, long-form pieces are drafted back as pages, and page updates and moves are gated on approval.
- **Stores files in Vercel Blob.** Export threads, save images and attachments, and read them back, authenticated by the project's OIDC token.
- **Posts a weekly analytics digest.** Every Monday it pulls Typefully post and follower analytics and posts two tables to a Slack channel you choose (`TYPEFULLY_ANALYTICS_CHANNEL`).

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?project-name=typefully-eve-template&repository-name=typefully-eve-template&repository-url=https%3A%2F%2Fgithub.com%2Fvercel-labs%2Ftypefully-eve-template%2Ftree%2Fmain&env=TYPEFULLY_API_KEY&envDescription=Your%20Typefully%20API%20key%20%28Settings%20%3E%20API%29&connect=%5B%7B%22type%22%3A%22slack%22%2C%22env%22%3A%22SLACK_CONNECTOR%22%2C%22triggers%22%3Atrue%2C%22triggerPath%22%3A%22%2Feve%2Fv1%2Fslack%22%7D%2C%7B%22type%22%3A%22notion%22%2C%22env%22%3A%22NOTION_CONNECTOR%22%2C%22method%22%3A%22mcp%22%7D%5D&stores=%5B%7B%22type%22%3A%22blob%22%2C%22access%22%3A%22public%22%7D%5D)

Deploying with the button provisions everything the agent needs and wires it up for you:

- a **Slack** connector (sets `SLACK_CONNECTOR`, with the event trigger pointed at `/eve/v1/slack`),
- a prompt for your **Typefully API key** (sets `TYPEFULLY_API_KEY`),
- a **Notion** connector (sets `NOTION_CONNECTOR`),
- a **Vercel Blob** store for the asset tools.

Once deployed, @mention the bot in your Slack workspace to start working on your social posts.

## Tech stack

| Layer | Technology |
| --- | --- |
| Agent framework | [eve](https://eve.dev) |
| Language | TypeScript (strict, ESM) |
| Chat surface | Slack, via [Vercel Connect](https://vercel.com/docs/connect) |
| Social publishing | Typefully (MCP), static API key (`TYPEFULLY_API_KEY`) |
| Briefs & long-form drafts | Notion (MCP), user-scoped OAuth via [Vercel Connect](https://vercel.com/docs/connect) |
| File storage | [Vercel Blob](https://vercel.com/docs/vercel-blob) |
| Model access | [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) |
| Sandbox | [Vercel Sandbox](https://vercel.com/docs/sandbox) |
| Lint & format | [Ultracite](https://www.ultracite.ai/) (Biome) |

**One secret to manage.** Slack and Notion authenticate through [Vercel Connect](https://vercel.com/docs/connect), and Vercel Blob and AI Gateway through [Vercel OIDC](https://vercel.com/docs/oidc) — no keys to manage for any of them. The one credential you supply is the Typefully API key, set as the `TYPEFULLY_API_KEY` environment variable in the Vercel project (and in `.env.local` for local development).

## Quick start with an AI coding agent

If you're working with an AI coding agent like Claude Code or Cursor, you can use this prompt to have it help you with building your agent:

```text
I want to build a Slack agent with the eve framework, using the Typefully social media agent template. Read the setup instructions at https://agent-resources.dev/typefully-eve-template.md and follow them. They will cover deploying the template, building with eve, how everything works overall, and more.
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
    typefully.ts            # Typefully MCP, static API key (TYPEFULLY_API_KEY); deletes and scheduling require approval
    notion.ts               # Notion MCP, user-scoped OAuth; page updates/moves require approval
  sandbox.ts                # Vercel Sandbox backend
  schedules/
    weekly-analytics.ts     # Monday cron: pull Typefully analytics, post a digest to Slack
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
    lint_against_style.ts   # check a draft against the target platform's banned-words list
    post_analytics_report.ts  # post the weekly analytics digest to a fixed Slack channel
  lib/
    user-preferences.ts     # principal-scoped Blob key + reserved-prefix guard
  skills/
    writing-quality/              # generic prose quality for anything written for humans
    x-style/                      # X voice, hooks, threads, specs, banned words
    linkedin-style/               # LinkedIn equivalents
    threads-style/                # Threads equivalents
    bluesky-style/                # Bluesky equivalents
    mastodon-style/               # Mastodon equivalents
```

## Pairing with the content agent template

The [eve content agent template](https://github.com/vercel-labs/eve-content-agent-template) is a full content assistant with a house voice and style skills for long-form surfaces this agent doesn't cover (blog posts, release notes, newsletters). Instead of merging all of that into this agent, you can deploy it as its own agent and let this one delegate to it through eve's [remote agents](https://eve.dev/docs/guides/remote-agents) feature.

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

3. Set `CONTENT_AGENT_URL` in this project's environment and mention the new subagent in `agent/instructions.md` so the agent knows when to hand off.

The remote agent runs in its own deployment with its own skills and connections, and it never sees this agent's conversation history, so this agent packs everything the writer needs into the call `message`. The result comes back as a normal tool result, the same shape as the local `researcher` and `reviewer` subagents.

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

You can chat with the agent directly in the dev TUI to test the Typefully, Notion, and Blob flows. The Slack surface itself only runs against a deployment. Ship changes with:

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
# Typefully API key — paste your key from Typefully Settings when prompted
vercel env add TYPEFULLY_API_KEY

# Notion connector (prints the UID notion/social-media-agent -> NOTION_CONNECTOR)
vercel connect create notion --name social-media-agent

# Slack connector (note the UID, e.g. slack/<name> -> SLACK_CONNECTOR), then point its
# event trigger at the route the agent serves
vercel connect create slack --name <name> --triggers
vercel connect attach slack/<name> --triggers --trigger-path /eve/v1/slack

# Blob store, connected to the project for all environments
vercel blob create-store <name> --access public --yes
```

## Customizing

- **Behavior:** edit `agent/instructions.md`. It describes the whole workflow: load the right skill first, ground work in the user's real social sets and drafts, draft freely but schedule and delete only on approval, draft long pieces into Notion, and get a fresh-eyes review before proposing a draft.
- **Approval gates:** edit the approval policy in `agent/connections/typefully.ts` (the `DELETE_TOOLS` / `PUBLISH_TOOLS` lists and the `publish_at` check) and the `APPROVAL_REQUIRED_TOOLS` list in `agent/connections/notion.ts` to change which MCP tools pause for a human decision.
- **Skills:** edit or add skills in `agent/skills/`. Each folder holds a `SKILL.md` plus its reference files. The five `*-style` skills carry per-platform guidance and a `banned-words.json` that the `lint_against_style` tool checks drafts against; `writing-quality` carries the generic prose rules. The reviewer subagent keeps its own identical copy of `writing-quality` under `agent/subagents/reviewer/skills/`.
- **Model:** edit `agent/agent.ts` (or run `/model` in the dev TUI).
- **Tools:** add or change tools in `agent/tools/`. The filename is the tool name.
- **Weekly analytics digest:** set `TYPEFULLY_ANALYTICS_CHANNEL` to the Slack channel id it should post to. Change the day or time in `agent/schedules/weekly-analytics.ts` (the cron is evaluated in UTC), and edit `agent/tools/post_analytics_report.ts` to change the report format. In dev, trigger a run with `curl -X POST http://localhost:3000/eve/v1/dev/schedules/weekly-analytics`.

The agent auto-updates as you edit these files.

## Learn more

- [eve documentation](https://eve.dev/docs/introduction): the framework powering this agent.
- [Vercel Connect](https://vercel.com/docs/connect): manages the Slack and Notion credentials.
- [Typefully](https://typefully.com): the social publishing platform the agent works through.
- [Vercel Blob](https://vercel.com/docs/vercel-blob): object storage for the asset tools.

## Related templates

- [eve Content Agent](https://github.com/vercel-labs/eve-content-agent-template)
- [eve Personal Agent](https://vercel.com/templates/nuxt/eve-personal-agent)
