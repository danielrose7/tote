const { getDefaultConfig } = require("expo/metro-config");
const { withShareExtension } = require("expo-share-extension/metro");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

// Watch the monorepo root so Metro can find the shared schema
config.watchFolders = [monorepoRoot];

// Only resolve from ios/node_modules — NOT root node_modules.
// Root inclusion causes pnpm to resolve duplicate package instances
// (different virtual store entries) which breaks React context.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
];

// Alias @tote/schema to the shared schema file in the monorepo root
config.resolver.extraNodeModules = {
  "@tote/schema": path.resolve(monorepoRoot, "src", "schema.ts"),
};

module.exports = withShareExtension(config);
