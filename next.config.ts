import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Checks message keys against messages/en.json at compile time.
const withNextIntl = createNextIntlPlugin({
  experimental: { createMessagesDeclaration: "./messages/en.json" },
});

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
    // The root layout sits under [locale], so unmatched addresses need their own page.
    globalNotFound: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);
