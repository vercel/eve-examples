import { defineMcpClientConnection } from "eve/connections";

/**
 * Bare Typefully tool names whose effects are irreversible. These always require
 * explicit writer approval before they run.
 */
const DELETE_TOOLS = [
  "typefully_delete_draft",
  "typefully_delete_comment",
  "typefully_delete_thread",
];

/**
 * Bare Typefully tool names that can publish or schedule a post. They are gated
 * only when the call actually publishes or schedules — i.e. when `publish_at` is
 * set — so saving a plain draft and editing copy stay friction-free.
 */
const PUBLISH_TOOLS = ["typefully_create_draft", "typefully_edit_draft"];

/**
 * Read `requestBody.publish_at` from a tool input without trusting its shape.
 *
 * @param input - The raw input the model passed to the tool.
 * @returns The `publish_at` value when present and well-formed, otherwise `undefined`.
 */
const readPublishAt = (input: unknown): unknown => {
  if (typeof input !== "object" || input === null) {
    return;
  }
  const body = (input as { requestBody?: unknown }).requestBody;
  if (typeof body !== "object" || body === null) {
    return;
  }
  return (body as { publish_at?: unknown }).publish_at;
};

export default defineMcpClientConnection({
  approval: ({ toolName, toolInput }) => {
    if (DELETE_TOOLS.some((tool) => toolName.includes(tool))) {
      return "user-approval";
    }
    if (PUBLISH_TOOLS.some((tool) => toolName.includes(tool))) {
      const publishAt = readPublishAt(toolInput);
      return typeof publishAt === "string" && publishAt.length > 0
        ? "user-approval"
        : "not-applicable";
    }
    return "not-applicable";
  },
  /**
   * Typefully's MCP server authenticates with a static API key. `getToken` runs on each
   * connection attempt and reads the key from the `TYPEFULLY_API_KEY` environment variable —
   * set it in the Vercel project (and `.env.local` for `pnpm dev`). eve sends the key as
   * `Authorization: Bearer <token>`. With `getToken`-only auth the connection is app-scoped:
   * one shared Typefully workspace credential across all Slack users.
   */
  auth: {
    getToken: () => {
      const token = process.env.TYPEFULLY_API_KEY;
      if (!token) {
        throw new Error("TYPEFULLY_API_KEY is not set.");
      }
      return Promise.resolve({ token });
    },
  },
  description:
    "Typefully: draft, schedule, and manage social posts across X, LinkedIn, Threads, " +
    "Bluesky, and Mastodon. List social sets (accounts) and their connected platforms; " +
    "create, edit, read, and list drafts; schedule posts and manage the publishing queue; " +
    "upload media; organize with tags; manage comment threads; and read post and follower analytics.",
  url: "https://mcp.typefully.com/mcp",
});
