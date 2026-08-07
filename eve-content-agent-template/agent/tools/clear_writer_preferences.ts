import { del, list } from "@vercel/blob";
import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";
import { writerPreferencesKey } from "#lib/writer-preferences.js";

/**
 * Tool that permanently deletes the current writer's saved preferences.
 *
 * @remarks
 * The Blob key is derived from the framework-resolved principal (`ctx.session.auth.current`),
 * never from model input, so a session can only ever clear its own writer's preferences.
 * Deletion is irreversible, so it is gated on human approval — in Slack an approve/deny button.
 * Authorization resolves from the ambient Vercel OIDC credentials.
 */
export default defineTool({
  description:
    "Permanently delete this writer's saved style preferences. Use only when the writer " +
    "explicitly asks to reset or forget their preferences. This is irreversible.",
  inputSchema: z.object({}),
  outputSchema: z.object({
    success: z.boolean(),
    deleted: z.boolean(),
    error: z.string().optional(),
  }),
  approval: always(),
  /**
   * Delete the current writer's preferences file, if any.
   *
   * @param _input - No input.
   * @param ctx - Tool runtime context; supplies the resolved principal.
   * @returns `deleted: true` when a file was removed, `false` when there was nothing to remove,
   * or `success: false` with an `error`.
   */
  async execute(_input, ctx) {
    const key = writerPreferencesKey(ctx.session.auth.current);
    if (!key) {
      return {
        success: false,
        deleted: false,
        error: "No signed-in writer to clear preferences for.",
      };
    }
    try {
      const { blobs } = await list({ prefix: key, limit: 1 });
      const blob = blobs.find((b) => b.pathname === key);
      if (!blob) {
        return { success: true, deleted: false };
      }
      await del(blob.url);
      return { success: true, deleted: true };
    } catch (error) {
      return {
        success: false,
        deleted: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to clear preferences",
      };
    }
  },
});
