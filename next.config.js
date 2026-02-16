const { withSentryConfig } = require("@sentry/nextjs");
const withSerwist = require("@serwist/next").default;

/** @type {import('next').NextConfig} */
const nextConfig = {}

const withSerwistConfig = withSerwist({
  swSrc: "src/sw.js",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
})(nextConfig);

module.exports = withSentryConfig(withSerwistConfig, {
  org: "the-labor-party",
  project: "javascript-nextjs",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  webpack: {
    automaticVercelMonitors: true,
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
