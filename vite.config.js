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
  server: {
    port: 3000, // 确保端口为 3000
    open: true, // 自动打开浏览器
  },
});
