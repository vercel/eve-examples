import { put } from "@vercel/blob";
import { defineTool } from "eve/tools";
import { z } from "zod";
import {
  isReservedUserPath,
  USER_PREFERENCES_PREFIX,
} from "#lib/user-preferences.js";

/**
 * Tool that uploads text or binary content to Vercel Blob storage.
 *
 * @remarks
 * Authorization resolves from the ambient Vercel credentials — the project's OIDC token
 * (`VERCEL_OIDC_TOKEN`, or the `x-vercel-oidc-token` request header on Vercel) — so no
 * `BLOB_READ_WRITE_TOKEN` is required and no token is passed in code. Binary content (images,
 * PDFs) is supplied base64-encoded with `isBase64: true`.
 */
export default defineTool({
  description:
    "Upload text or binary content to Vercel Blob storage and return its URL. Use when the " +
    "user wants to save or publish an asset — an exported draft, an image — to durable storage.",
  /**
   * Upload the content to Blob storage.
   *
   * @param input - Validated tool input.
   * @returns The asset's `url`, `downloadUrl`, stored `pathname`, and `contentType`, or
   * `success: false` with an `error` message.
   */
  async execute({
    pathname,
    content,
    contentType,
    isBase64,
    access,
    addRandomSuffix,
    allowOverwrite,
  }) {
    if (isReservedUserPath(pathname)) {
      return {
        contentType: contentType ?? "unknown",
        downloadUrl: "",
        error: `"${USER_PREFERENCES_PREFIX}" is reserved — use save_user_preferences instead.`,
        pathname,
        success: false,
        url: "",
      };
    }
    try {
      const body = isBase64 ? Buffer.from(content, "base64") : content;
      const blob = await put(pathname, body, {
        access: access ?? "public",
        addRandomSuffix: addRandomSuffix ?? false,
        allowOverwrite: allowOverwrite ?? false,
        contentType,
      });
      return {
        contentType: blob.contentType,
        downloadUrl: blob.downloadUrl,
        pathname: blob.pathname,
        success: true,
        url: blob.url,
      };
    } catch (error) {
      return {
        contentType: contentType ?? "unknown",
        downloadUrl: "",
        error: error instanceof Error ? error.message : "Upload failed",
        pathname,
        success: false,
        url: "",
      };
    }
  },
  inputSchema: z.object({
    access: z
      .enum(["public", "private"])
      .optional()
      .describe('Access level for the asset. Defaults to "public".'),
    addRandomSuffix: z
      .boolean()
      .optional()
      .describe(
        "Append a random suffix to avoid pathname collisions. Defaults to false."
      ),
    allowOverwrite: z
      .boolean()
      .optional()
      .describe(
        "Allow overwriting an existing blob at the same pathname. Defaults to false."
      ),
    content: z
      .string()
      .describe(
        "Raw text/JSON, or base64-encoded bytes when isBase64 is true."
      ),
    contentType: z
      .string()
      .optional()
      .describe(
        'MIME type, e.g. "text/markdown". Inferred from the extension when omitted.'
      ),
    isBase64: z
      .boolean()
      .optional()
      .describe(
        "Set true when content is base64-encoded binary data. Defaults to false."
      ),
    pathname: z
      .string()
      .min(1)
      .describe(
        'Path and filename including extension, e.g. "drafts/launch-post.md".'
      ),
  }),
  outputSchema: z.object({
    contentType: z.string(),
    downloadUrl: z.string(),
    error: z.string().optional(),
    pathname: z.string(),
    success: z.boolean(),
    url: z.string(),
  }),
});
