import {
  createMcpHandler,
  hostHeaderValidationResponse,
  localhostAllowedHostnames,
} from '@modelcontextprotocol/server';
import { createServer } from './server.js';

const handler = createMcpHandler(() => createServer());

const allowedHosts = ['agentic.jaredwray.com', ...localhostAllowedHostnames()];

// Workers set Host before fetch runs. An in-process client constructs a Request
// whose Host is filled in only when the message hits the network, so fall back
// to the URL hostname. A present Host header is what the check actually trusts.
function withHostHeader(request: Request): Request {
  if (request.headers.get('host')) return request;
  const headers = new Headers(request.headers);
  headers.set('host', new URL(request.url).host);
  return new Request(request, { headers });
}

const LANDING = [
  'agentic',
  'Operation manuals for shipping, hardening, releasing, and reviewing software, served over MCP.',
  '',
  'Endpoint: https://agentic.jaredwray.com/mcp',
  'Repository: https://github.com/jaredwray/agentic',
  '',
  'No authentication. The endpoint speaks Streamable HTTP.',
  'Tools: list_skills, get_skill, read_skill_file. One prompt per skill.',
  'Files are skill:// resources, or agentic://skills/ resources when the path contains a dot-segment.',
  '',
].join('\n');

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/' && request.method === 'GET') {
      return new Response(LANDING, {
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      });
    }
    if (url.pathname === '/mcp') {
      const guarded = withHostHeader(request);
      const rejected = hostHeaderValidationResponse(guarded, allowedHosts);
      if (rejected) return rejected;
      return handler.fetch(guarded);
    }
    return new Response('Not found\n', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  },
};
