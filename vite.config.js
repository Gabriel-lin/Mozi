import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  // prevent vite from obscuring rust errors
  clearScreen: false,
  // Env variables starting with the item of `envPrefix` will be exposed in tauri's source code through `import.meta.env`.
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"), // 设置 @ 为 src 目录的别名
      "@tauri-apps/api": path.resolve(
        __dirname,
        "node_modules/@tauri-apps/api"
      ), // 添加 Tauri API 别名
    },
  },
  build: {
    // Tauri uses Chromium on Windows and WebKit on macOS and Linux
    target: "chrome105",
    // don't minify for debug builds
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    // produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    chunkSizeWarningLimit: 500, // 将 chunk 大小警告限制提高到 1000 KB
    rollupOptions: {
      output: {
        manualChunks: {
          // 手动分割 chunk
          react: ["react", "react-dom"],
          echarts: ["echarts", "echarts-for-react"],
        },
      },
    },
  },
  server: {
    port: 3000,
    host: "0.0.0.0", // 允许所有网络接口访问
    strictPort: true, // 端口被占用时报错
    // open: true,
  }
});
