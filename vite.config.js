import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// 用打包當下的時間戳記當版本號,不用每次部署手動改版本、不會忘記,
// 也能讓使用者直接比對電腦/手機顯示的版本是不是同一次部署。
const buildVersion = new Date().toISOString();

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'prompt', // 偵測到新版先提示、由使用者按「立即更新」才套用,不要默默背景更新
      injectRegister: false, // 改成自己在 main.js 手動註冊,才能接到「有新版本」的通知事件
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: false, // 我們自己寫 public/manifest.json,不用 plugin 產生
      workbox: {
        // 只快取 App 殼(JS/CSS/HTML),不做資料離線同步
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        cleanupOutdatedCaches: true, // 每次部署都清掉舊版本殘留的 Service Worker 快取
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(buildVersion),
  },
  build: {
    outDir: 'dist',
  },
});
