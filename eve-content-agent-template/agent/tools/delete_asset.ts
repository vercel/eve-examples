import { del } from "@vercel/blob";
import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";
import { isReservedWriterUrl } from "#lib/writer-preferences.js";

/**
 * Tool that permanently deletes an asset from Vercel Blob storage.
 *
 * @remarks
 * Authorization resolves from the ambient Vercel OIDC credentials; no `BLOB_READ_WRITE_TOKEN`
 * is required. Deletion is irreversible, so this tool is gated on human approval — in Slack
 * it renders as an approve/deny button.
 */
export default defineTool({
  description:
    "Permanently delete an asset from Vercel Blob storage by its URL. Use only when the writer " +
    "explicitly asks to remove a stored file. This is irreversible.",
  inputSchema: z.object({
    url: z.url().describe("The full Vercel Blob URL of the asset to delete."),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    deleted: z.boolean(),
    url: z.string(),
    error: z.string().optional(),
  }),
  approval: always(),
  /**
   * Delete the asset.
   *
   * @param input - Validated tool input.
   * @returns `success`/`deleted` flags and the `url`, or `success: false` with an `error`.
   */
  async execute({ url }) {
    if (isReservedWriterUrl(url)) {
      return {
        success: false,
        deleted: false,
        url,
        error:
          "Writer preferences can only be cleared with clear_writer_preferences.",
      };
    }
    try {
      await del(url);
      return { success: true, deleted: true, url };
    } catch (error) {
      return {
        success: false,
        deleted: false,
        url,
        error: error instanceof Error ? error.message : "Delete failed",
      };
    }
  },
});
