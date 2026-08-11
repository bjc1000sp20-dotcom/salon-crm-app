import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: false, // 我們自己寫 public/manifest.json,不用 plugin 產生
      workbox: {
        // 只快取 App 殼(JS/CSS/HTML),不做資料離線同步
        globPatterns: ['**/*.{js,css,html,svg,png}'],
      },
    }),
  ],
  build: {
    outDir: 'dist',
  },
});
