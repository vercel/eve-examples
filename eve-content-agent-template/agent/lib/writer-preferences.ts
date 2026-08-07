import { createHash } from "node:crypto";

/**
 * Reserved Blob path prefix for per-writer preference files.
 *
 * @remarks
 * The writer-preferences tools own this prefix exclusively. The general-purpose asset tools
 * (`upload_asset`, `list_assets`, `get_asset_info`, `download_asset`, `delete_asset`) treat it as
 * off-limits so they can't be used as a side channel to read or overwrite another writer's
 * preferences — those files are only reachable through the principal-scoped preference tools.
 */
export const WRITER_PREFERENCES_PREFIX = "writer-preferences/";

/**
 * The current writer's principal, as projected onto a tool's `ctx.session.auth.current`.
 *
 * @remarks
 * Structural subset of eve's `SessionAuthContext`; kept narrow so this module doesn't depend on
 * the full tool-context type.
 */
type WriterPrincipal =
  | { readonly principalId: string; readonly principalType: string }
  | null
  | undefined;

/**
 * Whether a Blob pathname falls under the reserved writer-preferences prefix.
 *
 * @param pathname - A Blob object pathname (no leading slash), e.g. `drafts/post.md`.
 * @returns `true` when the path is reserved for writer preferences.
 */
export const isReservedWriterPath = (pathname: string): boolean =>
  pathname.startsWith(WRITER_PREFERENCES_PREFIX);

/** Leading slashes stripped from a URL pathname before the reserved-prefix check. */
const LEADING_SLASHES = /^\/+/;

/**
 * Whether a Blob URL points at a reserved writer-preferences object.
 *
 * @remarks
 * A public Blob URL embeds the object pathname as its URL path, so the reserved-prefix check
 * applies to the URL's pathname. Unparseable input is treated as not reserved; the caller's own
 * URL validation handles malformed URLs.
 *
 * @param url - A full Blob URL.
 * @returns `true` when the URL addresses a reserved writer-preferences object.
 */
export const isReservedWriterUrl = (url: string): boolean => {
  try {
    return isReservedWriterPath(
      new URL(url).pathname.replace(LEADING_SLASHES, "")
    );
  } catch {
    return false;
  }
};

/**
 * Resolve the Blob key holding the current writer's preferences.
 *
 * @remarks
 * The key is derived entirely from the framework-resolved principal — never from model input —
 * so a session can only ever read or write its own writer's preferences. The principal id is
 * hashed so the stored path carries no raw user identifier. Only `principalType: "user"`
 * principals (a signed-in writer, e.g. via Slack) get a key; app/service/runtime callers return
 * `null` so the tools can decline rather than share a single anonymous file.
 *
 * @param principal - The value of `ctx.session.auth.current`.
 * @returns The reserved Blob key for this writer, or `null` when there is no writer principal.
 */
export const writerPreferencesKey = (
  principal: WriterPrincipal
): string | null => {
  if (principal?.principalType !== "user" || !principal.principalId) {
    return null;
  }
  const id = createHash("sha256").update(principal.principalId).digest("hex");
  return `${WRITER_PREFERENCES_PREFIX}${id}.md`;
};
