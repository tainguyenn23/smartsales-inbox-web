import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  cacheOnFrontEndNav: false,
  aggressiveFrontEndNavCaching: false,
  cacheStartUrl: false,
  dynamicStartUrl: false,
  reloadOnOnline: true,
  workboxOptions: {
    runtimeCaching: [
      {
        urlPattern: /\/api\/v1(?:\/|\?|$)/i,
        handler: "NetworkOnly",
        method: "GET",
        options: { cacheName: "sensitive-api-get-network-only" },
      },
      {
        urlPattern: /\/api\/v1(?:\/|\?|$)/i,
        handler: "NetworkOnly",
        method: "POST",
        options: { cacheName: "sensitive-api-post-network-only" },
      },
    ],
    navigateFallbackDenylist: [/^\/chat(?:\/|$)/, /^\/dashboard(?:\/|$)/],
  },
});

const nextConfig: NextConfig = {
  // Mobile-first PWA configuration
  turbopack: {},
  // Baseline security headers; pages must not be framed (clickjacking on /dashboard).
  headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default withPWA(nextConfig);
