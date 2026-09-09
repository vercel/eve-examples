import { defineMemory } from "eve/memory";
import { fileMemory } from "eve/memory/file";
import { byPrincipal } from "eve/memory/scope";

export default defineMemory({
  description: "Remember stable facts and preferences about the caller.",
  provider: fileMemory(),
  scope(context) {
    // Do not expose memory tools until the deployed app has durable storage.
    if (process.env.VERCEL && !process.env.EVE_MEMORY_BLOB_STORE_ID) {
      return null;
    }

    return byPrincipal(context);
  },
});
