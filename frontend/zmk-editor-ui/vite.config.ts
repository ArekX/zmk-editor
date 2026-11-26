import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// `make dev` passes the URL the backend actually bound (it walks past
// taken ports), so the proxy never lands on another process.
const BACKEND = process.env.ZMK_EDITOR_BACKEND_URL ?? "http://127.0.0.1:7373"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  // The bundle is embedded in the Go binary and served locally, so one
  // larger chunk costs nothing worth splitting for.
  build: { chunkSizeWarningLimit: 1024 },
  server: {
    port: 5173,
    proxy: {
      // The backend only accepts loopback Host headers, so keep the origin.
      "/api": { target: BACKEND, changeOrigin: true },
    },
  },
})
