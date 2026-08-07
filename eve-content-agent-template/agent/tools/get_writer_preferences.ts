import { list } from "@vercel/blob";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { writerPreferencesKey } from "#lib/writer-preferences.js";

/**
 * Tool that loads the current writer's saved style preferences from Vercel Blob.
 *
 * @remarks
 * The Blob key is derived from the framework-resolved principal (`ctx.session.auth.current`),
 * never from model input, so a session can only ever read its own writer's preferences. Returns
 * `found: false` with empty `preferences` when the writer has none yet — that is a normal state,
 * not an error. Authorization resolves from the ambient Vercel OIDC credentials.
 */
export default defineTool({
  description:
    "Load this writer's saved style preferences (standing notes that personalize drafts on top " +
    "of the house style). Call it before drafting; returns empty when the writer has none yet.",
  inputSchema: z.object({}),
  outputSchema: z.object({
    found: z.boolean(),
    preferences: z.string(),
    error: z.string().optional(),
  }),
  /**
   * Read the current writer's preferences file.
   *
   * @param _input - No input.
   * @param ctx - Tool runtime context; supplies the resolved principal.
   * @returns `found` plus the `preferences` Markdown (empty when none), or an `error`.
   */
  async execute(_input, ctx) {
    const key = writerPreferencesKey(ctx.session.auth.current);
    if (!key) {
      return {
        found: false,
        preferences: "",
        error: "No signed-in writer to load preferences for.",
      };
    }
    try {
      const { blobs } = await list({ prefix: key, limit: 1 });
      const blob = blobs.find((b) => b.pathname === key);
      if (!blob) {
        return { found: false, preferences: "" };
      }
      const response = await fetch(blob.url);
      if (!response.ok) {
        return {
          found: false,
          preferences: "",
          error: `Failed to read preferences: ${response.status} ${response.statusText}`,
        };
      }
      return { found: true, preferences: await response.text() };
    } catch (error) {
      return {
        found: false,
        preferences: "",
        error:
          error instanceof Error ? error.message : "Failed to load preferences",
      };
    }
  },
});
