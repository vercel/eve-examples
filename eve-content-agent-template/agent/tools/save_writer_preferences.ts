import { put } from "@vercel/blob";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { writerPreferencesKey } from "#lib/writer-preferences.js";

/**
 * Maximum size of a writer-preferences document, in characters.
 *
 * @remarks
 * Preferences are a short, curated set of standing notes — not a transcript. The bound keeps the
 * file small and cheap to load into context on every draft.
 */
const MAX_PREFERENCES_LENGTH = 20_000;

/**
 * Tool that saves the current writer's style preferences to Vercel Blob.
 *
 * @remarks
 * The Blob key is derived from the framework-resolved principal (`ctx.session.auth.current`),
 * never from model input, so a session can only ever write its own writer's preferences. This
 * overwrites the whole document, so the caller should `get_writer_preferences` first, integrate
 * the new standing preference, and save the merged result — keeping the file curated rather than
 * append-only. Authorization resolves from the ambient Vercel OIDC credentials.
 */
export default defineTool({
  description:
    "Save this writer's standing style preferences (Markdown). Overwrites the whole document — " +
    "load the current preferences first, merge in the new one, then save. Use only for durable " +
    "preferences the writer states, not one-off edits to a single draft.",
  inputSchema: z.object({
    preferences: z
      .string()
      .min(1)
      .max(MAX_PREFERENCES_LENGTH)
      .describe(
        "The full preferences document as Markdown — the merged result, not just the new note."
      ),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    pathname: z.string().optional(),
    error: z.string().optional(),
  }),
  /**
   * Write the current writer's preferences file.
   *
   * @param input - Validated tool input.
   * @param ctx - Tool runtime context; supplies the resolved principal.
   * @returns `success: true` with the stored `pathname`, or `success: false` with an `error`.
   */
  async execute({ preferences }, ctx) {
    const key = writerPreferencesKey(ctx.session.auth.current);
    if (!key) {
      return {
        success: false,
        error: "No signed-in writer to save preferences for.",
      };
    }
    try {
      const blob = await put(key, preferences, {
        access: "public",
        contentType: "text/markdown",
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      return { success: true, pathname: blob.pathname };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to save preferences",
      };
    }
  },
});
