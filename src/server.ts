import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { catalog, type SkillFile, type SkillRecord } from './catalog.js';
import pkg from '../package.json' with { type: 'json' };

const INSTRUCTIONS = [
  'agentic serves operation manuals (Agent Skills). Each skill is a step-by-step playbook to load and follow literally, not reference documentation.',
  'Call list_skills for the catalog, get_skill to load a manual, and read_skill_file for reference.md, scripts, and templates when a manual points at them.',
  'Skills marked manual mutate repos, open PRs, or run expensive pipelines: load them only when the user explicitly asks.',
  'Model-invoked skills may be loaded whenever a task matches their description.',
  'The same files are available as skill:// resources and, when a path contains a dot-segment, as agentic://skills/ resources. Each skill is also a prompt.',
].join(' ');

const skillSummary = z.object({
  name: z.string(),
  category: z.string().nullable(),
  description: z.string(),
  invocation: z.enum(['manual', 'model-invoked']),
  uri: z.string(),
});

const fileIndex = z.object({
  path: z.string(),
  size: z.number().int().nonnegative(),
  uri: z.string(),
});

function summary(skill: SkillRecord) {
  return {
    name: skill.name,
    category: skill.category,
    description: skill.description,
    invocation: skill.invocation,
    uri: skill.uri,
  };
}

function indexOf(file: SkillFile) {
  return { path: file.path, size: file.size, uri: file.uri };
}

function unknownSkill(name: string) {
  const names = catalog.skills.map((skill) => skill.name).join(', ');
  return {
    isError: true as const,
    content: [{ type: 'text' as const, text: `Unknown skill "${name}". Skills: ${names}` }],
  };
}

function resolveFile(skill: SkillRecord, requestPath: string): SkillFile | undefined {
  if (!requestPath || requestPath.startsWith('/') || requestPath.includes('\\')) return undefined;
  const segments = requestPath.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) return undefined;
  return skill.files.find((file) => file.path === requestPath);
}

export function createServer(): McpServer {
  const server = new McpServer(
    { name: 'agentic', version: pkg.version },
    { instructions: INSTRUCTIONS },
  );

  server.registerTool(
    'list_skills',
    {
      title: 'List skills',
      description:
        'List every operation manual: name, category, whether it is manual or model-invoked, description, and resource URI.',
      inputSchema: z.object({}),
      outputSchema: z.object({ skills: z.array(skillSummary) }),
      annotations: { readOnlyHint: true },
    },
    async () => {
      const skills = catalog.skills.map(summary);
      const text = skills
        .map(
          (skill) =>
            `${skill.name} — ${skill.category ?? 'root'} — ${skill.invocation} — ${skill.description}`,
        )
        .join('\n');
      return {
        content: [{ type: 'text', text }],
        structuredContent: { skills },
      };
    },
  );

  server.registerTool(
    'get_skill',
    {
      title: 'Get skill',
      description:
        'Load one operation manual by its kebab-case name. Returns the manual body and an index of its files. Follow the manual literally. Read a supporting file with read_skill_file only when the manual points at it.',
      inputSchema: z.object({
        name: z.string().describe('Skill name, for example code-review'),
      }),
      outputSchema: skillSummary.extend({
        manual: z.string(),
        files: z.array(fileIndex),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ name }) => {
      const skill = catalog.byName.get(name);
      if (!skill) return unknownSkill(name);
      const files = skill.files.map(indexOf);
      const supporting = files.filter((file) => file.path !== 'SKILL.md');
      const fileLines =
        supporting.length === 0
          ? 'Supporting files: none.'
          : [
              'Supporting files (read with read_skill_file or resources/read when the manual points at them):',
              ...supporting.map((file) => `${file.path} · ${file.size} bytes · ${file.uri}`),
            ].join('\n');
      return {
        content: [{ type: 'text', text: `${skill.manual.trimEnd()}\n\n${fileLines}` }],
        structuredContent: { ...summary(skill), manual: skill.manual, files },
      };
    },
  );

  server.registerTool(
    'read_skill_file',
    {
      title: 'Read skill file',
      description:
        'Read one file from a skill folder. path is relative to that folder, for example reference.md or templates/.claude/settings.json.',
      inputSchema: z.object({
        name: z.string().describe('Skill name'),
        path: z.string().describe('Path relative to the skill folder'),
      }),
      outputSchema: z.object({
        name: z.string(),
        path: z.string(),
        uri: z.string(),
        mimeType: z.string(),
        text: z.string(),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ name, path }) => {
      const skill = catalog.byName.get(name);
      if (!skill) return unknownSkill(name);
      const file = resolveFile(skill, path);
      if (!file) {
        const paths = skill.files.map((entry) => entry.path).join(', ');
        return {
          isError: true as const,
          content: [
            {
              type: 'text' as const,
              text: `No file "${path}" in ${name}. Files: ${paths}`,
            },
          ],
        };
      }
      return {
        content: [{ type: 'text' as const, text: file.text }],
        structuredContent: {
          name: skill.name,
          path: file.path,
          uri: file.uri,
          mimeType: file.mimeType,
          text: file.text,
        },
      };
    },
  );

  for (const skill of catalog.skills) {
    server.registerPrompt(
      skill.name,
      { title: skill.name, description: skill.description },
      () => ({
        messages: [
          {
            role: 'user',
            content: { type: 'text', text: skill.manual },
          },
        ],
      }),
    );

    for (const file of skill.files) {
      const description = file.hidden
        ? `File of ${skill.name} whose path contains a dot-segment, served outside skill://.`
        : file.path === 'SKILL.md'
          ? skill.description
          : `Supporting file of ${skill.name}.`;
      const text = file.text;
      const mime = file.mimeType;
      server.registerResource(file.uri, file.uri, { description, mimeType: mime }, async (uri) => ({
        contents: [{ uri: uri.href, mimeType: mime, text }],
      }));
    }
  }

  return server;
}
