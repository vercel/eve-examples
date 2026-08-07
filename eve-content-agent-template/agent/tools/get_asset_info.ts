import { head } from "@vercel/blob";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { isReservedWriterUrl } from "#lib/writer-preferences.js";

/**
 * Tool that fetches metadata for a Vercel Blob asset without downloading its content.
 *
 * @remarks
 * Authorization resolves from the ambient Vercel OIDC credentials; no `BLOB_READ_WRITE_TOKEN`
 * is required. Use it to confirm an asset exists, or to check its size or content type before
 * downloading. Returns `exists: false` when the asset is not found.
 */
export default defineTool({
  description:
    "Get metadata (size, content type, upload date) for a Vercel Blob asset without " +
    "downloading it. Use to check whether an asset exists or inspect it before downloading.",
  inputSchema: z.object({
    url: z.url().describe("The full Blob URL of the asset to inspect."),
  }),
  outputSchema: z.object({
    exists: z.boolean(),
    url: z.string(),
    downloadUrl: z.string().optional(),
    pathname: z.string().optional(),
    size: z.number().optional(),
    contentType: z.string().optional(),
    uploadedAt: z.string().optional(),
    error: z.string().optional(),
  }),
  /**
   * Look up the asset's metadata.
   *
   * @param input - Validated tool input.
   * @returns `exists: true` with the asset's metadata, or `exists: false` with an `error`.
   */
  async execute({ url }) {
    if (isReservedWriterUrl(url)) {
      return {
        exists: false,
        url,
        error: "Writer preferences are private — use get_writer_preferences.",
      };
    }
    try {
      const metadata = await head(url);
      return {
        exists: true,
        url: metadata.url,
        downloadUrl: metadata.downloadUrl,
        pathname: metadata.pathname,
        size: metadata.size,
        contentType: metadata.contentType,
        uploadedAt: metadata.uploadedAt.toISOString(),
      };
    } catch (error) {
      return {
        exists: false,
        url,
        error: error instanceof Error ? error.message : "Asset not found",
      };
    }
  },
});
