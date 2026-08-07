import { defineAgent } from "eve";

/**
 * Fresh-context reviewer subagent.
 *
 * @remarks
 * A declared subagent — its `subagents/reviewer/` location is what marks it as one — that the
 * root agent delegates to for a final, unbiased pass over a finished draft. It runs in its own
 * child session with no shared history and, like every declared subagent, inherits none of the
 * root's skills, connections, or tools. The root packs only the surface and the draft into
 * `message`; the reviewer loads the matching style rubric itself through its own
 * `get_surface_rubric` tool — a build-time bundle (`lib/rubric.generated.ts`, written by
 * `scripts/sync-shared.mjs`) of the house lists and each surface's best-practices and specs, so
 * no skills or sandbox are needed. That isolation is the point — a reviewer that never saw the
 * source or the drafting reasoning catches the voice drift, AI-tells, and spec misses that
 * self-review rationalizes away. It complements `lint_against_style` (a deterministic
 * banned-words floor) by judging the qualitative rubric a regex cannot.
 *
 * `description` is required for a subagent: the root reads it to decide when to delegate.
 * `outputSchema` makes the verdict a structured result the root can act on directly.
 *
 * @see The review rubric and verdict contract in this folder's `instructions.md`.
 */
export default defineAgent({
  description:
    "Review a finished draft with fresh context against the active surface's style rubric " +
    "(voice, AI-tells, plain English, structure, specs) before it goes to the writer. The " +
    "caller passes the surface and the draft in the message; the reviewer loads the matching " +
    "rubric itself and returns a verdict.",
  model: "anthropic/claude-opus-4.8",
  outputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["verdict", "issues"],
    properties: {
      verdict: {
        type: "string",
        enum: ["ready", "revise"],
        description:
          "'ready' = clean enough to send as-is; 'revise' = fix the issues first.",
      },
      issues: {
        type: "array",
        description:
          "One entry per concrete problem; empty when the verdict is 'ready'.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["severity", "rule", "quote", "fix"],
          properties: {
            severity: { type: "string", enum: ["high", "medium", "low"] },
            rule: {
              type: "string",
              description: "The rubric rule or reference the excerpt breaks.",
            },
            quote: {
              type: "string",
              description: "The offending excerpt, quoted from the draft.",
            },
            fix: {
              type: "string",
              description: "A concrete suggested change.",
            },
          },
        },
      },
    },
  },
});
