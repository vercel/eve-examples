import { connect } from "@vercel/connect/eve";
import { defineMcpClientConnection } from "eve/connections";

/**
 * Vercel Connect connector UID for the Notion MCP server.
 *
 * @defaultValue `"notion/sanity-copilot"` — the UID `vercel connect create notion
 * --name sanity-copilot` produces (UIDs are `<type>/<name>`)
 * Override with the `NOTION_CONNECTOR` environment variable when your connector uses a different
 * name.
 */
const notionConnector = process.env.NOTION_CONNECTOR ?? "notion/sanity-copilot";

/**
 * Bare Notion MCP tool names whose calls require human approval before running.
 *
 * @remarks
 * Add a tool's bare name here to gate it. eve hands the approval policy the qualified name,
 * `<connection>__<tool>`, where `<tool>` is exactly what the MCP server names it (e.g.
 * `notion__notion-update-pages`; Notion's own tool names carry a `notion-` prefix). Entries
 * are matched as substrings, so they gate the tool regardless of the server's naming. Page
 * creation (`notion-create-pages`) is left ungated on purpose: drafting into Notion is the
 * normal flow.
 */
const APPROVAL_REQUIRED_TOOLS = [
  "notion-update-pages",
  "notion-move-pages",
  "notion-update-data-source",
  "notion-update-view",
];

/**
 * Notion workspace connection (MCP) exposing search, read, and edit tools to the model.
 *
 * @remarks
 * Authorization is user-scoped via Vercel Connect: each user signs in through their own
 * browser consent flow, the per-user token is resolved before every tool call, and it is
 * never exposed to the model.
 *
 * Tools listed in {@link APPROVAL_REQUIRED_TOOLS} are gated on human approval: a gated call
 * pauses for an approve/deny decision (rendered as a Slack button) before it runs.
 *
 * @see {@link https://vercel.com/docs/connect | Vercel Connect}
 */
export default defineMcpClientConnection({
  approval: ({ toolName }) =>
    APPROVAL_REQUIRED_TOOLS.some((tool) => toolName.includes(tool))
      ? "user-approval"
      : "not-applicable",
  auth: connect(notionConnector),
  description: "Notion workspace: search, read, and edit pages and databases.",
  url: "https://mcp.notion.com/mcp",
});
