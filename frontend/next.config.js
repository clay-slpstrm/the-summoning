/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Static export — the app is fully client-rendered (all routes "use client",
  // no server components / API routes / SSR). Produces a static `out/` dir that
  // Cloudflare Pages serves from its CDN. See ARCHITECTURE.md §8.3.
  output: "export",
  // Required by `output: export` — Next's image optimizer needs a server.
  // We use no next/image today; this keeps the build green if one is added.
  images: { unoptimized: true },
  webpack: (config) => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    config.resolve.alias = {
      ...config.resolve.alias,
      "@react-native-async-storage/async-storage": false,
    };
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
};

module.exports = nextConfig;
