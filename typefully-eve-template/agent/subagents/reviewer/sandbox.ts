import { defineSandbox } from "eve/sandbox";
import { vercel } from "eve/sandbox/vercel";

/**
 * Reviewer sandbox configuration.
 *
 * @remarks
 * A subagent's sandbox does not inherit from the root, and the reviewer needs one to read its
 * `writing-quality` skill's seeded reference files. Pins the same hosted Vercel Sandbox backend
 * as the root so the subagent behaves identically in development and production.
 *
 * @see {@link https://vercel.com/docs/sandbox | Vercel Sandbox}
 */
export default defineSandbox({
  backend: vercel(),
});
