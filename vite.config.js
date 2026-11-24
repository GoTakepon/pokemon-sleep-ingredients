import { defineConfig } from "vite";
import fs from "fs";

import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ command }) => {
  const build = command === "build" ? {
    id: new Date().toISOString(),
    commit: process.env.GITHUB_SHA?.slice(0, 7),
  } : null;

  return {
    base: '/pokemon-sleep-ingredients/',
    define: {
      __APP_BUILD__: JSON.stringify(build),
    },
    plugins: [
      {
        name: "published-version",
        apply: "build",
        generateBundle() {
          this.emitFile({
            type: "asset",
            fileName: "version.json",
            source: JSON.stringify(build),
          });
        },
      },
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'script-defer',
        workbox: {
          // Only precache html, css, js, and some json files
          globPatterns: ['**/*.{js,css,html,png,json,ico,svg}'],
          // Version checks must read the published file even when an older worker controls the app.
          globIgnores: ['**/node_modules/**/*', 'version.json'],
          maximumFileSizeToCacheInBytes: 3000000, // allows logo.png to pass precache checks
          clientsClaim: true,
          skipWaiting: true,
          ignoreURLParametersMatching: [/^v$/]
        },
        devOptions: {
          enabled: true, // Enables PWA plugin to build a SW in dev mode!
          type: 'module'
        }
      })
    ],
    server: {
      host: true,            // 0.0.0.0 で全LAN端末からアクセス可能
      port: 5173,            // Vite既定ポート
      https: {
        key: fs.readFileSync("./cert/key.pem"),   // 作成した証明書のパス
        cert: fs.readFileSync("./cert/cert.pem")
      }
    },
    preview: {
      host: true,
      port: 4173,
      https: {
        key: fs.readFileSync("./cert/key.pem"),
        cert: fs.readFileSync("./cert/cert.pem")
      }
    },
  };
});
