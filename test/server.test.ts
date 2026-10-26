import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index.js';
import { stripFrontmatter } from '../scripts/lib/frontmatter.mjs';
import { SKILLS_DIR, skillFiles, skillRoots } from '../scripts/lib/skill-files.mjs';
import pkg from '../package.json' with { type: 'json' };

const ENDPOINT = 'https://agentic.jaredwray.com/mcp';
const clients: Client[] = [];

function connect(mode: 'legacy' | 'auto' = 'legacy'): Promise<Client> {
  const client = new Client(
    { name: 'agentic-test', version: '0.0.0' },
    mode === 'auto' ? { versionNegotiation: { mode: 'auto' } } : undefined,
  );
  clients.push(client);
  const transport = new StreamableHTTPClientTransport(new URL(ENDPOINT), {
    fetch: (input, init) => worker.fetch(new Request(input, init)),
  });
  return client.connect(transport).then(() => client);
}

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

async function rpc(body: unknown, host = 'agentic.jaredwray.com'): Promise<{ status: number; payload: unknown }> {
  const response = await worker.fetch(
    new Request(`https://${host}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify(body),
    }),
  );
  const text = await response.text();
  const dataLine = text
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('data: '));
  const payload = dataLine ? JSON.parse(dataLine.slice('data: '.length)) : text ? JSON.parse(text) : null;
  return { status: response.status, payload };
}

describe('mcp server', () => {
  it('answers initialize with the server identity', async () => {
    const client = await connect();
    expect(client.getProtocolEra()).toBe('legacy');
    expect(client.getServerVersion()).toEqual({ name: 'agentic', version: pkg.version });
    expect(client.getInstructions()).toContain('operation manuals');
  });

  it('negotiates the modern protocol era', async () => {
    const client = await connect('auto');
    expect(client.getProtocolEra()).toBe('modern');
    expect(client.getServerVersion()?.name).toBe('agentic');
  });

  it('lists tools, prompts, and resources for every skill', async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual(['get_skill', 'list_skills', 'read_skill_file']);

    const { prompts } = await client.listPrompts();
    const skillNames = skillRoots().map((root) => root.split('/').at(-1) ?? '');
    expect(prompts.map((prompt) => prompt.name).sort()).toEqual([...skillNames].sort());

    const { resources } = await client.listResources();
    const uris = new Set(resources.map((resource) => resource.uri));
    for (const file of skillFiles()) {
      const uri = file.hidden ? `agentic://skills/${file.rel}` : `skill://${file.rel}`;
      expect(uris.has(uri), uri).toBe(true);
    }
  });

  it('returns a manual and reads a supporting file', async () => {
    const client = await connect();
    const listed = await client.callTool({ name: 'list_skills', arguments: {} });
    const skills = listed.structuredContent as { skills: Array<{ name: string; invocation: string }> };
    expect(skills.skills).toHaveLength(skillRoots().length);
    expect(skills.skills.find((skill) => skill.name === 'submit-pr')?.invocation).toBe('manual');
    expect(skills.skills.find((skill) => skill.name === 'debug')?.invocation).toBe('model-invoked');

    const loaded = await client.callTool({
      name: 'get_skill',
      arguments: { name: 'defense-in-depth-nodejs' },
    });
    const body = stripFrontmatter(
      readFileSync(join(SKILLS_DIR, 'security/defense-in-depth-nodejs/SKILL.md'), 'utf8'),
    );
    const skill = loaded.structuredContent as {
      manual: string;
      files: Array<{ path: string; uri: string }>;
    };
    expect(skill.manual).toBe(body);
    const paths = new Map(skill.files.map((file) => [file.path, file.uri]));
    expect(paths.get('reference.md')).toBe('skill://security/defense-in-depth-nodejs/reference.md');
    expect(paths.get('scripts/lockdown-repo.sh')).toBe(
      'skill://security/defense-in-depth-nodejs/scripts/lockdown-repo.sh',
    );
    expect(paths.get('templates/.claude/settings.json')).toBe(
      'agentic://skills/security/defense-in-depth-nodejs/templates/.claude/settings.json',
    );

    const missing = await client.callTool({ name: 'get_skill', arguments: { name: 'no-such-skill' } });
    expect(missing.isError).toBe(true);

    const script = readFileSync(
      join(SKILLS_DIR, 'security/defense-in-depth-nodejs/scripts/lockdown-repo.sh'),
      'utf8',
    );
    const read = await client.callTool({
      name: 'read_skill_file',
      arguments: { name: 'defense-in-depth-nodejs', path: 'scripts/lockdown-repo.sh' },
    });
    expect((read.structuredContent as { text: string }).text).toBe(script);

    const escaped = await client.callTool({
      name: 'read_skill_file',
      arguments: { name: 'defense-in-depth-nodejs', path: '../x' },
    });
    expect(escaped.isError).toBe(true);

    const reference = await client.readResource({ uri: 'skill://engineering/adr/reference.md' });
    const referenceBody = reference.contents[0];
    expect(referenceBody && 'text' in referenceBody ? referenceBody.text : undefined).toBe(
      readFileSync(join(SKILLS_DIR, 'engineering/adr/reference.md'), 'utf8'),
    );
    const hidden = await client.readResource({
      uri: 'agentic://skills/security/defense-in-depth-nodejs/templates/.claude/settings.json',
    });
    const hiddenBody = hidden.contents[0];
    expect(hiddenBody && 'text' in hiddenBody ? hiddenBody.text : undefined).toBe(
      readFileSync(join(SKILLS_DIR, 'security/defense-in-depth-nodejs/templates/.claude/settings.json'), 'utf8'),
    );

    const prompt = await client.getPrompt({ name: 'code-review' });
    expect(prompt.messages).toHaveLength(1);
    expect(prompt.messages[0]?.content).toMatchObject({
      type: 'text',
      text: stripFrontmatter(readFileSync(join(SKILLS_DIR, 'engineering/code-review/SKILL.md'), 'utf8')),
    });
  });

  it('serves a landing page, rejects a foreign host, and 404s unknown paths', async () => {
    const home = await worker.fetch(new Request('https://agentic.jaredwray.com/'));
    expect(home.status).toBe(200);
    expect(home.headers.get('content-type')).toContain('text/plain');
    expect(await home.text()).toContain('https://agentic.jaredwray.com/mcp');

    const missing = await worker.fetch(new Request('https://agentic.jaredwray.com/nope'));
    expect(missing.status).toBe(404);

    const foreign = await rpc(
      { jsonrpc: '2.0', id: 1, method: 'tools/list' },
      'evil.example',
    );
    expect(foreign.status).toBe(403);

    const initialized = await rpc({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'curl', version: '0' },
      },
    });
    expect(initialized.status).toBe(200);
    expect(initialized.payload).toMatchObject({
      result: { serverInfo: { name: 'agentic', version: pkg.version } },
    });
  });
});
