import {
  metadataCorsHandler,
  protectedResourceMetadataHandler,
} from '@clerk/mcp-tools/next';
import { mcpAuthOptions } from '@/lib/mcp/config';

// RFC 9728 metadata for /mcp: tells MCP clients to sign in with Clerk.
const handler = protectedResourceMetadataHandler({
  ...mcpAuthOptions,
  properties: { resource_name: 'Tote' },
});
const corsHandler = metadataCorsHandler();

export { handler as GET, corsHandler as OPTIONS };
