import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The demo dataset is read from data/ when the home page is (re)generated.
  outputFileTracingIncludes: { "/app": ["./data/**/*.json"] },
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

export default nextConfig;
