import { withClerkMcpAuth } from '@clerk/mcp-tools/next';
import { createMcpHandler } from 'mcp-handler';
import { MCP_INSTRUCTIONS, mcpAuthOptions } from '@/lib/mcp/config';
import { registerMcpTools } from '@/lib/mcp/tools';

/**
 * Tote's remote MCP server (Streamable HTTP). MCP clients connect with no
 * credentials, get a 401 that points them to Clerk's OAuth sign-in and
 * consent, and then call tools as the user who approved them.
 *
 * Requires the endpoint to be registered in Clerk (Dashboard → Agents → MCP
 * servers), which turns on audience claims for OAuth tokens.
 */

// add_item reads the product page, which can be slow.
export const maxDuration = 60;

const handler = createMcpHandler(registerMcpTools, {
  serverInfo: { name: 'tote', version: '1.0.0' },
  instructions: MCP_INSTRUCTIONS,
});

const authHandler = withClerkMcpAuth(handler, mcpAuthOptions);

// Browser-based clients (e.g. MCP Inspector) must be able to read the 401
// challenge, and send these headers on the preflight, which carries no token.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Authorization, Content-Type, Mcp-Protocol-Version, Mcp-Method, Mcp-Name, Mcp-Session-Id',
  'Access-Control-Expose-Headers': 'WWW-Authenticate, Mcp-Session-Id',
};

async function corsAuthHandler(request: Request) {
  const response = await authHandler(request);
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(corsHeaders)) {
    headers.set(name, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function preflight() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export {
  corsAuthHandler as GET,
  corsAuthHandler as POST,
  corsAuthHandler as DELETE,
  preflight as OPTIONS,
};
