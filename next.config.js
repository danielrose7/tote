const { withWorkflow } = require("workflow/next");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['jazz-tools'],
  turbopack: {},
  // Bundle native modules for Jazz server-side support
  serverExternalPackages: [
    'cojson-core-napi',
    'cojson-core-napi-linux-x64-gnu',
    'cojson-core-napi-linux-x64-musl',
    'cojson-core-napi-linux-arm64-gnu',
    'cojson-core-napi-linux-arm64-musl',
    'cojson-core-napi-darwin-x64',
    'cojson-core-napi-darwin-arm64',
    'cojson-core-napi-linux-arm-gnueabihf',
  ],
};

module.exports = withWorkflow(nextConfig);
