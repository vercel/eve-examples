import { connect } from "@vercel/connect/eve";
import { defineMcpClientConnection } from "eve/connections";

/**
 * Vercel Connect connector UID for the Notion MCP server.
 *
 * @defaultValue `"mcp.notion.com/notion"` — the UID `vercel connect create mcp.notion.com
 * --name notion` produces (UIDs are `<type>/<name>`)
 * Override with the `NOTION_CONNECTOR` environment variable when your connector uses a different
 * name.
 */
const notionConnector = process.env.NOTION_CONNECTOR ?? "mcp.notion.com/notion";

/**
 * Bare Notion MCP tool names whose calls require human approval before running.
 *
 * @remarks
 * Add a tool's bare name here to gate it. Each entry is matched as a substring because the
 * model sees every tool under its qualified name (e.g. `notion__notion-create-pages`), and the
 * approval policy may receive either the qualified or the bare form depending on the runtime.
 * Notion's MCP server exposes no delete tool, so this gates create/update tools; today only
 * page creation is gated. Candidates to add: `notion-update-page`, `notion-create-database`,
 * `notion-update-database`.
 */
const APPROVAL_REQUIRED_TOOLS = ["notion-create-pages"];

/**
 * Notion workspace connection (MCP) exposing search, read, and edit tools to the model.
 *
 * @remarks
 * Authorization is user-scoped via Vercel Connect: each writer signs in through their own
 * browser consent flow, the per-user token is resolved before every tool call, and it is
 * never exposed to the model. All Notion tools are exposed, so the model creates draft pages
 * directly through the connection.
 *
 * Tools listed in {@link APPROVAL_REQUIRED_TOOLS} are gated on human approval: a gated call
 * pauses for an approve/deny decision (rendered as a Slack button) before it runs. Today only
 * page creation (`notion-create-pages`) is gated; every other Notion tool — search, read, and
 * edits — runs without a prompt.
 *
 * @see {@link https://vercel.com/docs/connect | Vercel Connect}
 */
export default defineMcpClientConnection({
  url: "https://mcp.notion.com/mcp",
  description: "Notion workspace: search, read, and edit pages and databases.",
  auth: connect(notionConnector),
  approval: ({ toolName }) =>
    APPROVAL_REQUIRED_TOOLS.some((tool) => toolName.includes(tool))
      ? "user-approval"
      : "not-applicable",
});
