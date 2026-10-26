import catalogJson from './generated/catalog.json' with { type: 'json' };
import { parseFrontmatter, stripFrontmatter } from '../scripts/lib/frontmatter.mjs';

const DESCRIPTION_BUDGET = 1024;

export type Invocation = 'manual' | 'model-invoked';

export type SkillFile = {
  path: string;
  rel: string;
  size: number;
  uri: string;
  hidden: boolean;
  mimeType: string;
  text: string;
};

export type SkillRecord = {
  name: string;
  category: string | null;
  description: string;
  invocation: Invocation;
  uri: string;
  folder: string;
  manual: string;
  files: SkillFile[];
};

export type Catalog = {
  skills: SkillRecord[];
  byName: Map<string, SkillRecord>;
};

function mimeType(path: string): string {
  if (path.endsWith('.md')) return 'text/markdown';
  if (path.endsWith('.json')) return 'application/json';
  if (path.endsWith('.yml') || path.endsWith('.yaml')) return 'text/yaml';
  if (path.endsWith('.sh')) return 'text/x-shellscript';
  return 'text/plain';
}

function isHiddenRel(rel: string): boolean {
  return rel.split('/').some((segment) => segment.startsWith('.'));
}

function uriFor(rel: string, hidden: boolean): string {
  return hidden ? `agentic://skills/${rel}` : `skill://${rel}`;
}

export function loadCatalog(files: Record<string, string>): Catalog {
  const problems: string[] = [];
  const skillPaths = Object.keys(files)
    .filter((key) => key === 'SKILL.md' || key.endsWith('/SKILL.md'))
    .sort();
  if (skillPaths.length === 0) problems.push('catalog has no skills');
  if (skillPaths.includes('SKILL.md')) {
    problems.push('skills/SKILL.md is not a skill; each skill needs its own folder');
  }

  const folders = skillPaths
    .filter((path) => path !== 'SKILL.md')
    .map((path) => path.slice(0, -'/SKILL.md'.length));
  const skills: SkillRecord[] = [];
  const seen = new Map<string, string>();

  for (const folder of folders) {
    const skillPath = `${folder}/SKILL.md`;
    const raw = files[skillPath];
    if (raw === undefined) {
      problems.push(`${skillPath}: missing contents`);
      continue;
    }
    const parsed = parseFrontmatter(raw);
    if (parsed.error || !parsed.data) {
      problems.push(`${skillPath}: ${parsed.error ?? 'missing frontmatter'}`);
      continue;
    }
    const data = parsed.data;
    const name = typeof data.name === 'string' ? data.name : '';
    const description = typeof data.description === 'string' ? data.description : '';
    const whenToUse = typeof data.when_to_use === 'string' ? data.when_to_use : '';
    const folderName = folder.slice(folder.lastIndexOf('/') + 1);
    if (!name) problems.push(`${skillPath}: missing name`);
    else if (name !== folderName) {
      problems.push(`${skillPath}: name "${name}" does not match folder "${folderName}"`);
    }
    if (!description) problems.push(`${skillPath}: missing description`);
    else if (description.length + whenToUse.length > DESCRIPTION_BUDGET) {
      problems.push(
        `${skillPath}: description (+when_to_use) is ${description.length + whenToUse.length} chars, over ${DESCRIPTION_BUDGET}`,
      );
    }
    if (name && seen.has(name)) {
      problems.push(`${skillPath}: duplicate skill name "${name}" (also in ${seen.get(name)})`);
    } else if (name) seen.set(name, skillPath);
    const flag = data['disable-model-invocation'];
    if (flag !== undefined && typeof flag !== 'boolean') {
      problems.push(`${skillPath}: disable-model-invocation must be a boolean`);
    }

    const nested = folders.filter((other) => other.startsWith(`${folder}/`));
    const owned = Object.keys(files)
      .filter((key) => key.startsWith(`${folder}/`))
      .filter((key) => !nested.some((other) => key === `${other}/SKILL.md` || key.startsWith(`${other}/`)))
      .sort();
    const encoder = new TextEncoder();
    const fileRecords: SkillFile[] = owned.map((rel) => {
      const text = files[rel] ?? '';
      const hidden = isHiddenRel(rel);
      const path = rel.slice(folder.length + 1);
      return {
        path,
        rel,
        size: encoder.encode(text).byteLength,
        uri: uriFor(rel, hidden),
        hidden,
        mimeType: mimeType(path),
        text,
      };
    });

    const slash = folder.indexOf('/');
    skills.push({
      name,
      category: slash === -1 ? null : folder.slice(0, slash),
      description,
      invocation: flag === true ? 'manual' : 'model-invoked',
      uri: uriFor(skillPath, false),
      folder,
      manual: stripFrontmatter(raw),
      files: fileRecords,
    });
  }

  if (problems.length > 0) {
    throw new Error(`invalid skill catalog:\n${problems.map((problem) => `- ${problem}`).join('\n')}`);
  }
  skills.sort((a, b) => a.name.localeCompare(b.name));
  return { skills, byName: new Map(skills.map((skill) => [skill.name, skill])) };
}

export const catalog = loadCatalog(catalogJson as Record<string, string>);
