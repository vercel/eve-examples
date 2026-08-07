import { defineAgent } from "eve";

/**
 * Root agent runtime configuration.
 *
 * @remarks
 * Sets the language model for the content assistant. The rest of the agent's surface
 * (channels, connections, tools, skills) is discovered from the filesystem under `agent/`.
 */
export default defineAgent({
  model: "anthropic/claude-opus-4.8",
});
