import type { NextConfig } from "next";

const api = process.env.NEXT_PUBLIC_API_URL ?? "https://aislerun.158-220-85-120.sslip.io";

const config: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "font-src 'self'",
              `img-src 'self' ${api}`,
              `media-src ${api}`,
              `connect-src 'self' ${api}`,
              "frame-ancestors 'none'",
              "base-uri 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default config;
