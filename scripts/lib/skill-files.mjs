// Shared definition of a skill folder and the files that belong to it.
// A skill is a directory that contains SKILL.md. Files under a nested skill
// belong to that nested skill only.

import { readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const SKILLS_DIR = join(ROOT, 'skills');

export function walk(dir, acc = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`symlink not supported in skills/: ${relative(ROOT, path)}`);
    }
    if (entry.isDirectory()) walk(path, acc);
    else if (entry.isFile()) acc.push(path);
  }
  return acc;
}

export function toPosix(path) {
  return path.split('\\').join('/');
}

export function isHiddenRel(rel) {
  return rel.split('/').some((segment) => segment.startsWith('.'));
}

export function skillRoots() {
  const roots = [];
  const visit = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    if (entries.some((entry) => entry.isFile() && entry.name === 'SKILL.md')) roots.push(dir);
    for (const entry of entries) {
      if (entry.isSymbolicLink()) {
        throw new Error(`symlink not supported in skills/: ${relative(ROOT, join(dir, entry.name))}`);
      }
      if (entry.isDirectory()) visit(join(dir, entry.name));
    }
  };
  visit(SKILLS_DIR);
  return roots;
}

export function skillMarkdownFiles() {
  return skillRoots().map((root) => join(root, 'SKILL.md'));
}

// Every regular file that belongs to a skill, with paths relative to skills/.
export function skillFiles() {
  const roots = skillRoots();
  const relRootOf = (root) => toPosix(relative(SKILLS_DIR, root));
  const files = [];
  for (const root of roots) {
    const relRoot = relRootOf(root);
    const nested = roots
      .map(relRootOf)
      .filter((other) => other.startsWith(`${relRoot}/`));
    for (const abs of walk(root)) {
      const rel = toPosix(relative(SKILLS_DIR, abs));
      if (nested.some((other) => rel === other || rel.startsWith(`${other}/`))) continue;
      files.push({
        abs,
        rel,
        relRoot,
        hidden: isHiddenRel(rel),
      });
    }
  }
  return files;
}
