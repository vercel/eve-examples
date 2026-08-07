import { defineSandbox } from "eve/sandbox";
import { vercel } from "eve/sandbox/vercel";

/**
 * Agent sandbox configuration.
 *
 * @remarks
 * Pins the hosted Vercel Sandbox backend for both local development and production, so the
 * same environment runs everywhere. Running locally requires the project to be linked and
 * authenticated to Vercel.
 *
 * @see {@link https://vercel.com/docs/sandbox | Vercel Sandbox}
 */
export default defineSandbox({
  backend: vercel(),
});
