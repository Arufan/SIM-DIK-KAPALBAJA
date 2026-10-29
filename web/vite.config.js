import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon.png"],
      manifest: {
        name: "SIM-DIK KAPALBAJA",
        short_name: "SIM-DIK KB",
        description: "Sistem Monitoring Pendidikan Calon Anggota — UKM Kapal Baja",
        lang: "id",
        theme_color: "#071c14",
        background_color: "#071c14",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "icons/pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Precache the whole app shell: after one online visit the app loads
        // offline. API traffic is intentionally NOT cached — data lives in
        // IndexedDB and syncs via the outbox when connectivity returns.
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
        navigateFallback: "index.html",
      },
    }),
  ],
  server: { port: 5173 },
});
