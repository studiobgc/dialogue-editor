import { defineConfig } from "vite";

export default defineConfig({
  clearScreen: false,
  server: {
    host: "dialogue.local",
    port: 80,
    strictPort: false,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
