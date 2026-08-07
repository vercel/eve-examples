import { defineAgent } from "eve";

/**
 * Fresh-context draft-review subagent.
 *
 * @remarks
 * The root delegates here for a final, unbiased pass over a finished draft before proposing it
 * to the user. The reviewer runs in a fresh child session and inherits none of the root's
 * skills, connections, or tools — it carries its own copy of the `writing-quality` skill (and
 * its own sandbox to read that skill's references), so the root passes only the draft and any
 * voice or audience context in `message`. A reviewer that never saw the sources or the drafting
 * reasoning catches the AI-tells, bloated wording, and structure misses that self-review
 * rationalizes away. The skill copy under this folder's `skills/` is duplicated from the root's
 * on purpose; keep the two in step when editing either, except where the root's copy points at
 * other root-only skills (e.g. `seo-aeo-best-practices`) — this copy states those concerns are
 * out of scope instead, since the reviewer can't load them.
 *
 * `description` is what the root reads to decide when to delegate; `outputSchema` makes the
 * verdict a structured result it can act on directly.
 *
 * @see The review rubric and verdict contract in this folder's `instructions.md`.
 */
export default defineAgent({
  description:
    "Review a finished content draft with fresh context against the writing-quality rubric " +
    "(AI-tells, plain English, structure, web-content specs) before it goes to the user. The " +
    "caller passes the full draft plus any voice or audience context in the message; the " +
    "reviewer loads its own rubric and returns a verdict with concrete issues.",
  model: "anthropic/claude-fable-5",
  outputSchema: {
    additionalProperties: false,
    properties: {
      issues: {
        description:
          "One entry per concrete problem; empty when the verdict is 'ready'.",
        items: {
          additionalProperties: false,
          properties: {
            fix: {
              description: "A concrete suggested change.",
              type: "string",
            },
            quote: {
              description: "The offending excerpt, quoted from the draft.",
              type: "string",
            },
            rule: {
              description: "The rubric rule or reference the excerpt breaks.",
              type: "string",
            },
            severity: { enum: ["high", "medium", "low"], type: "string" },
          },
          required: ["severity", "rule", "quote", "fix"],
          type: "object",
        },
        type: "array",
      },
      verdict: {
        description:
          "'ready' = clean enough to send as-is; 'revise' = fix the issues first.",
        enum: ["ready", "revise"],
        type: "string",
      },
    },
    required: ["verdict", "issues"],
    type: "object",
  },
});
