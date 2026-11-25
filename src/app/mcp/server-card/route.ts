import { serverCardHandler } from '@clerk/mcp-tools/next';
import { MCP_RESOURCE_URL } from '@/lib/mcp/config';

// Public description of the MCP server for clients that look before they
// connect. Never put user data here: it is public and cached.
const handler = serverCardHandler({
  name: 'tools.tote/collections',
  version: '1.0.0',
  title: 'Tote',
  description: 'Read and organize your Tote collections of product links.',
  websiteUrl: 'https://tote.tools',
  resourceUrl: MCP_RESOURCE_URL,
});

export {
  handler as GET,
  handler as HEAD,
  handler as OPTIONS,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
};
