import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'), // 设置 @ 为 src 目录的别名
    },
  },
  build: {
    chunkSizeWarningLimit: 500, // 将 chunk 大小警告限制提高到 1000 KB
    rollupOptions: {
      output: {
        manualChunks: {
          // 手动分割 chunk
          react: ['react', 'react-dom'],
          echarts: ['echarts', 'echarts-for-react'],
        },
      },
    },
  },
  server: {
    port: 3000, // 确保端口为 3000
    open: true, // 自动打开浏览器
  },
});
