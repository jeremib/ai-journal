import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AI Journal",
    short_name: "Journal",
    description: "Journal your projects with text, audio, video and links — then chat with AI about all of it.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fafaf9",
    theme_color: "#4f46e5",
    // Share sheet integration: a shared link arrives as GET /share?url=…&text=…
    // (Chromium/Android installed PWAs. iOS Safari has no Web Share Target —
    // /share also accepts these params directly, so an iOS Shortcut can open it.)
    share_target: {
      action: "/share",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
