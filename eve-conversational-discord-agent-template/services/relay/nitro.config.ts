import { defineConfig } from "nitro";

export default defineConfig({
  serverDir: "./server",
  modules: ["workflow/nitro"],
  workflow: {
    runtime: "nodejs24.x",
    sourcemap: false,
  },
} as Parameters<typeof defineConfig>[0] & {
  workflow: { runtime: string; sourcemap: boolean };
});
