import { list } from "@vercel/blob";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { isReservedWriterPath } from "#lib/writer-preferences.js";

/**
 * Tool that lists assets in Vercel Blob storage, optionally filtered by path prefix.
 *
 * @remarks
 * Authorization resolves from the ambient Vercel OIDC credentials; no `BLOB_READ_WRITE_TOKEN`
 * is required. Use it to browse stored assets or find a specific one before downloading.
 */
export default defineTool({
  description:
    "List assets in Vercel Blob storage, optionally filtered by a path prefix. Returns each " +
    "asset's URL, size, and upload date. Use to browse stored content or locate an asset.",
  inputSchema: z.object({
    prefix: z
      .string()
      .optional()
      .describe(
        'Filter by path prefix/folder, e.g. "drafts/". Omit to list everything.'
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(1000)
      .optional()
      .describe("Maximum number of assets to return. Defaults to 1000."),
  }),
  outputSchema: z.object({
    assets: z.array(
      z.object({
        url: z.string(),
        downloadUrl: z.string(),
        pathname: z.string(),
        size: z.number(),
        uploadedAt: z.string(),
      })
    ),
    count: z.number(),
    hasMore: z.boolean(),
    cursor: z.string().optional(),
    error: z.string().optional(),
  }),
  /**
   * List matching assets.
   *
   * @param input - Validated tool input.
   * @returns The matching `assets`, their `count`, a `hasMore` flag, and a pagination
   * `cursor`, or an empty list with an `error` message on failure.
   */
  async execute({ prefix, limit }) {
    try {
      const { blobs, hasMore, cursor } = await list({ prefix, limit });
      const visible = blobs.filter(
        (blob) => !isReservedWriterPath(blob.pathname)
      );
      return {
        assets: visible.map((blob) => ({
          url: blob.url,
          downloadUrl: blob.downloadUrl,
          pathname: blob.pathname,
          size: blob.size,
          uploadedAt: blob.uploadedAt.toISOString(),
        })),
        count: visible.length,
        hasMore,
        cursor,
      };
    } catch (error) {
      return {
        assets: [],
        count: 0,
        hasMore: false,
        error: error instanceof Error ? error.message : "Failed to list assets",
      };
    }
  },
});
