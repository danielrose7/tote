import {
  authorizationServerMetadataHandler,
  metadataCorsHandler,
} from '@clerk/mcp-tools/next';

// For older MCP clients that look for OAuth metadata on our origin instead of
// following the protected resource metadata to Clerk.
const handler = authorizationServerMetadataHandler();
const corsHandler = metadataCorsHandler();

export { handler as GET, corsHandler as OPTIONS };
