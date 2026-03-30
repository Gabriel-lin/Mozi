import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@mozi/core": path.resolve(__dirname, "packages/core/index.ts"),
      "@mozi/store": path.resolve(__dirname, "packages/store/index.ts"),
    },
  },
  optimizeDeps: {
    exclude: ["@tauri-apps/api"],
  },
  build: {
    target: "chrome105",
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          echarts: ["echarts", "echarts-for-react"],
        },
      },
    },
  },
  server: {
    port: 3000,
    host: "0.0.0.0",
    strictPort: true,
    proxy: {
      "/api/v1/auth": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
      "/api/v1/users": {
        target: "http://localhost:3002",
        changeOrigin: true,
      },
      "/api/v1/workspaces": {
        target: "http://localhost:3002",
        changeOrigin: true,
      },
      "/api/v1/agents": {
        target: "http://localhost:3003",
        changeOrigin: true,
      },
      "/api/v1/mcp": {
        target: "http://localhost:3005",
        changeOrigin: true,
      },
    },
  },
});
