// WebMCP origin trial tokens (Chrome, Edge), comma-separated. Register the
// origin at https://developer.chrome.com/origintrials and set the env var on
// Vercel; with no tokens, browsers that ship WebMCP by default (ChatGPT's
// built-in browser, Brave Nightly) still see Tote's tools.
const webmcpOriginTrialTokens = (process.env.WEBMCP_ORIGIN_TRIAL_TOKENS ?? '')
  .split(',')
  .map((token) => token.trim())
  .filter(Boolean);

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    if (webmcpOriginTrialTokens.length === 0) return [];
    return [
      {
        source: '/((?!api/).*)',
        headers: [
          { key: 'Origin-Trial', value: webmcpOriginTrialTokens.join(', ') },
        ],
      },
    ];
  },
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

module.exports = nextConfig;
