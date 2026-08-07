import { connectSlackCredentials } from "@vercel/connect/eve";
import { callSlackApi } from "eve/channels/slack";
import { defineTool } from "eve/tools";
import { z } from "zod";

/**
 * Slack chat.postMessage text hard limit, with headroom left for the code fences and labels
 * the plain-text fallback wraps around the tables.
 */
const MAX_MESSAGE_CHARS = 39_000;

/**
 * Column gutter used between cells in the plain-text fallback tables.
 */
const GUTTER = "  ";

/**
 * Largest `page_size` a Slack data_table block accepts; the report shows every row up to this,
 * rather than the default 5, so readers do not have to page through the digest.
 */
const MAX_PAGE_SIZE = 100;

/**
 * Matches a Slack error that points at the message blocks, so the tool knows to retry with the
 * plain-text fallback rather than give up.
 */
const BLOCK_ERROR = /block/i;

/**
 * One report table: a header row plus body rows, all cells pre-stringified by the caller.
 *
 * @remarks
 * Cells are addressed by column index; a short row is padded with blanks and any extra cells
 * beyond the column count are dropped, so a ragged row can never misalign the table. Bounds
 * (20 columns, 200 rows) stay within the Slack data_table block limits.
 */
const tableSchema = z.object({
  columns: z.array(z.string().max(200)).min(1).max(20),
  rows: z.array(z.array(z.string().max(500)).max(20)).max(200),
});

type Table = z.infer<typeof tableSchema>;

/**
 * Normalize a row to exactly `width` cells, so every row matches the header column count as the
 * data_table block requires.
 *
 * @param row - The caller's row cells.
 * @param width - The table's column count.
 * @returns Exactly `width` cell strings.
 */
const fitRow = (row: readonly string[], width: number): string[] =>
  Array.from({ length: width }, (_, column) => row[column] ?? "");

/**
 * A Slack data_table `raw_text` cell. Empty text is rejected by Slack, so blanks become a dash.
 *
 * @param value - The cell's string value.
 * @returns A `raw_text` cell object.
 */
const rawTextCell = (value: string) => ({
  text: value.trim() === "" ? "-" : value,
  type: "raw_text" as const,
});

/**
 * Build a Slack data_table block from a table, with the columns as the header row.
 *
 * @param caption - Accessible caption and visible label for the table.
 * @param table - The validated table.
 * @returns A data_table block ready for `chat.postMessage` `blocks`.
 */
const dataTableBlock = (caption: string, table: Table) => {
  const width = table.columns.length;
  const body =
    table.rows.length > 0
      ? table.rows.map((row) => fitRow(row, width).map(rawTextCell))
      : [
          Array.from({ length: width }, (_, column) =>
            rawTextCell(column === 0 ? "No data for this period" : "")
          ),
        ];
  return {
    caption,
    page_size: Math.min(MAX_PAGE_SIZE, Math.max(1, body.length)),
    rows: [table.columns.map(rawTextCell), ...body],
    type: "data_table" as const,
  };
};

/**
 * Render a table as a fixed-width monospace block for the plain-text fallback.
 *
 * @param table - The validated table.
 * @returns The table body as newline-joined rows, without the surrounding code fence.
 */
const renderTable = (table: Table): string => {
  const widths = table.columns.map((heading, column) =>
    Math.max(
      heading.length,
      ...table.rows.map((row) => (row[column] ?? "").length)
    )
  );
  const line = (cells: readonly string[]): string =>
    table.columns
      .map((_, column) => (cells[column] ?? "").padEnd(widths[column]))
      .join(GUTTER);
  const separator = widths.map((width) => "-".repeat(width)).join(GUTTER);
  return [line(table.columns), separator, ...table.rows.map(line)].join("\n");
};

/**
 * Build the plain-text fallback message body.
 *
 * @param summary - Optional lead-in line.
 * @param postsTable - The posts table.
 * @param followersTable - The followers table.
 * @returns The message text, capped at the Slack length limit.
 */
const fallbackText = (
  summary: string | undefined,
  postsTable: Table,
  followersTable: Table
): string =>
  [
    summary,
    postsTable.rows.length > 0
      ? `Posts\n\`\`\`\n${renderTable(postsTable)}\n\`\`\``
      : "Posts\nNo posts this period.",
    `Followers\n\`\`\`\n${renderTable(followersTable)}\n\`\`\``,
  ]
    .filter((section): section is string => Boolean(section))
    .join("\n\n")
    .slice(0, MAX_MESSAGE_CHARS);

/**
 * Tool that posts the weekly Typefully analytics digest to the team's analytics Slack channel.
 *
 * @remarks
 * Posts the digest only to the channel in `TYPEFULLY_ANALYTICS_CHANNEL`, never a model-supplied
 * channel. Renders the tables as Slack `data_table` blocks, retrying once as fixed-width text if
 * Slack rejects the blocks. The bot token comes from the Slack channel's Vercel Connect
 * credentials, so no Slack secret lives in code.
 */
export default defineTool({
  description:
    "Post the weekly Typefully analytics digest, a posts table and a followers table, to the " +
    "team's analytics Slack channel. Use this when the user asks for an analytics report. Build " +
    "each table from the analytics tools and pass every cell as a string.",
  async execute({ summary, postsTable, followersTable }) {
    const channel = process.env.TYPEFULLY_ANALYTICS_CHANNEL;
    if (!channel) {
      return {
        error: "TYPEFULLY_ANALYTICS_CHANNEL is not set.",
        posted: false,
      };
    }
    const text = fallbackText(summary, postsTable, followersTable);
    const postsBlock =
      postsTable.rows.length > 0
        ? dataTableBlock("Posts", postsTable)
        : {
            text: { text: "No posts this period.", type: "mrkdwn" as const },
            type: "section" as const,
          };
    const blocks = [
      ...(summary
        ? [
            {
              text: { text: summary, type: "mrkdwn" as const },
              type: "section" as const,
            },
          ]
        : []),
      postsBlock,
      dataTableBlock("Followers", followersTable),
    ];
    try {
      const { botToken } = connectSlackCredentials(
        process.env.SLACK_CONNECTOR ?? "slack/social-media-agent"
      );
      const post = (body: Record<string, unknown>) =>
        callSlackApi({
          body: { channel, unfurl_links: false, ...body },
          botToken,
          operation: "chat.postMessage",
        });
      const withBlocks = await post({ blocks, text });
      if (withBlocks.ok === true) {
        return { channel, posted: true };
      }
      const error = String(withBlocks.error ?? "unknown_error");
      if (!BLOCK_ERROR.test(error)) {
        return { error, posted: false };
      }
      const textOnly = await post({ text });
      return textOnly.ok === true
        ? { channel, posted: true, usedTextFallback: true }
        : { error: String(textOnly.error ?? "unknown_error"), posted: false };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Slack post failed",
        posted: false,
      };
    }
  },
  inputSchema: z.object({
    followersTable: tableSchema.describe(
      "Follower analytics: one row per social account or period, cells as strings."
    ),
    postsTable: tableSchema.describe(
      "Post analytics: one row per post, cells as strings."
    ),
    summary: z
      .string()
      .max(1000)
      .optional()
      .describe(
        "Summary of the report, 1-2 sentences. Write this in a casual tone."
      ),
  }),
  outputSchema: z.object({
    channel: z.string().optional(),
    error: z.string().optional(),
    posted: z.boolean(),
    usedTextFallback: z.boolean().optional(),
  }),
});
