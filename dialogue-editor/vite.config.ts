import { defineConfig } from "vite";

export default defineConfig({
  clearScreen: false,
  server: {
    host: "dialogue.local",
    port: 3000,
    strictPort: false,
    allowedHosts: ["dialogue.local"],
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
