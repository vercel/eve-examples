import { defineTool } from "eve/tools";
import { z } from "zod";
import { isReservedWriterUrl } from "#lib/writer-preferences.js";

/**
 * Host suffix that a downloadable URL must end with.
 *
 * @remarks
 * Restricting downloads to Vercel Blob hosts prevents this tool from being used to fetch
 * arbitrary internal or third-party URLs (an SSRF vector), since the `url` is model-supplied.
 */
const BLOB_HOST_SUFFIX = ".blob.vercel-storage.com";

/**
 * Tool that downloads the contents of a Vercel Blob asset.
 *
 * @remarks
 * Authorization resolves from the ambient Vercel OIDC credentials; no `BLOB_READ_WRITE_TOKEN`
 * is required. Text content is returned raw; binary content (images, PDFs) is returned
 * base64-encoded with `isBase64: true`. Only Vercel Blob URLs are accepted (see
 * {@link BLOB_HOST_SUFFIX}).
 */
export default defineTool({
  description:
    "Download and return the contents of a Vercel Blob asset. Use when the writer wants to " +
    "read or reuse a stored file. Text is returned raw; binary files come back base64-encoded.",
  inputSchema: z.object({
    url: z.url().describe("The full Vercel Blob URL of the asset to download."),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    url: z.string(),
    contentType: z.string().optional(),
    isBase64: z.boolean().optional(),
    content: z.string().optional(),
    error: z.string().optional(),
  }),
  /**
   * Fetch and return the asset contents.
   *
   * @param input - Validated tool input.
   * @returns The asset `content` (raw text or base64) with its `contentType`, or
   * `success: false` with an `error` message.
   */
  async execute({ url }) {
    if (isReservedWriterUrl(url)) {
      return {
        success: false,
        url,
        error: "Writer preferences are private — use get_writer_preferences.",
      };
    }
    try {
      if (!new URL(url).hostname.endsWith(BLOB_HOST_SUFFIX)) {
        return {
          success: false,
          url,
          error: `Refusing to download: only Vercel Blob URLs (*${BLOB_HOST_SUFFIX}) are allowed.`,
        };
      }

      const response = await fetch(url);
      if (!response.ok) {
        return {
          success: false,
          url,
          error: `Failed to download: ${response.status} ${response.statusText}`,
        };
      }

      const contentType =
        response.headers.get("content-type") ?? "application/octet-stream";
      const isText =
        contentType.startsWith("text/") || contentType.includes("json");
      const content = isText
        ? await response.text()
        : Buffer.from(await response.arrayBuffer()).toString("base64");

      return { success: true, url, contentType, isBase64: !isText, content };
    } catch (error) {
      return {
        success: false,
        url,
        error: error instanceof Error ? error.message : "Download failed",
      };
    }
  },
});
