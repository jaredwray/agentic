#!/usr/bin/env node
// Compile skills/ into src/generated/catalog.json for the Worker bundle.
// Skills on disk stay the source of truth; the JSON is a build artifact.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ROOT, SKILLS_DIR, skillFiles, skillRoots } from './lib/skill-files.mjs';

if (existsSync(join(SKILLS_DIR, 'SKILL.md'))) {
  console.error('skills/SKILL.md is not a skill. Put each skill in its own folder.');
  process.exit(1);
}

const roots = skillRoots();
if (roots.length === 0) {
  console.error('no skills found under skills/');
  process.exit(1);
}

const catalog = {};
for (const file of skillFiles()) {
  const bytes = readFileSync(file.abs);
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    console.error(`not valid UTF-8: skills/${file.rel}`);
    process.exit(1);
  }
  catalog[file.rel] = text;
}

const sorted = Object.fromEntries(Object.keys(catalog).sort().map((key) => [key, catalog[key]]));
const out = join(ROOT, 'src/generated/catalog.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(sorted, null, 2)}\n`);
console.log(`catalog: ${roots.length} skills, ${Object.keys(sorted).length} files → src/generated/catalog.json`);
