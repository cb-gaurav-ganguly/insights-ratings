import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The Cricbuzz API does not send CORS headers for localhost, so the dev server proxies /cb to it.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/cb": {
        target: "https://apiserver.cricbuzz.com",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/cb/, ""),
      },
    },
  },
});
