/** @type {import('next').NextConfig} */
// Plain .mjs (not .ts) so `next start` needs no TypeScript at runtime — the
// production image prunes devDependencies, and a .ts config makes Next try to
// install typescript on boot.
const nextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  images: { unoptimized: true },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
