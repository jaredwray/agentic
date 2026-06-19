#!/usr/bin/env node
// Validates the agentic skills plugin. Zero dependencies so CI needs no install step.
//
// Checks:
//  1. Every skills/**/SKILL.md has `name` (kebab-case, matching its folder) and `description`.
//  2. `description` (+ `when_to_use` if present) is <= 1536 characters.
//  3. Flag types are sane (`disable-model-invocation`/`user-invocable` boolean; `allowed-tools` list).
//  4. `name` is unique across the plugin.
//  5. Every relative markdown link inside a SKILL.md resolves to a file that exists.
//  6. Supporting files (`reference.md`, `scripts/*`) are referenced by their SKILL.md, and any
//     `reference.md`/`scripts/` pointer in a SKILL.md resolves to a real file (no orphans either way).
//  7. plugin.json / marketplace.json parse and their referenced paths exist.
//  8. Orchestration-category skills (release-ops, security, growth, project-setup) set
//     `disable-model-invocation: true` so a mutating/expensive loop never auto-fires.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, basename, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DESC_BUDGET = 1536;
const ORCHESTRATION = new Set(['release-ops', 'security', 'growth', 'project-setup']);
// Skills in an orchestration category that are genuinely read-only may opt out here.
const MODEL_INVOCABLE_EXCEPTIONS = new Set();

const errors = [];
const warnings = [];
const err = (file, msg) => errors.push(`${relative(ROOT, file)}: ${msg}`);
const warn = (file, msg) => warnings.push(`${relative(ROOT, file)}: ${msg}`);

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

function stripQuotes(s) {
  s = s.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

// Minimal YAML-frontmatter parser: top-level `key: value` pairs, folded multi-line scalars
// (indented continuation lines joined with spaces), flow arrays `[a, b]`, block sequences (`- x`),
// and `true`/`false` booleans. Sufficient for the SKILL.md frontmatter shape this repo uses.
function parseFrontmatter(content) {
  if (!content.startsWith('---')) return { error: 'missing YAML frontmatter (no leading `---`)' };
  const close = content.indexOf('\n---', 3);
  if (close === -1) return { error: 'unterminated YAML frontmatter (no closing `---`)' };
  const block = content.slice(content.indexOf('\n') + 1, close);
  const data = {};
  let key = null;
  for (const line of block.split('\n')) {
    if (!line.trim()) continue;
    const indented = /^\s/.test(line);
    const m = line.match(/^([A-Za-z0-9_-]+):\s?(.*)$/);
    if (m && !indented) {
      key = m[1];
      data[key] = m[2];
    } else if (key && indented) {
      const t = line.trim();
      if (t.startsWith('- ')) {
        if (!Array.isArray(data[key])) {
          const seed = String(data[key] ?? '').trim();
          data[key] = seed ? [seed] : [];
        }
        data[key].push(stripQuotes(t.slice(2)));
      } else {
        data[key] = `${String(data[key] ?? '').trim()} ${t}`.trim();
      }
    }
  }
  for (const k of Object.keys(data)) {
    if (Array.isArray(data[k])) continue;
    const v = String(data[k]).trim();
    if (v === 'true') data[k] = true;
    else if (v === 'false') data[k] = false;
    else if (v.startsWith('[') && v.endsWith(']')) {
      data[k] = v.slice(1, -1).split(',').map((s) => stripQuotes(s)).filter(Boolean);
    } else data[k] = stripQuotes(v);
  }
  return { data };
}

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function validateSkill(file, seenNames) {
  const content = readFileSync(file, 'utf8');
  const folder = dirname(file);
  const folderName = basename(folder);
  const category = (() => {
    const rel = relative(join(ROOT, 'skills'), folder).split('/');
    return rel.length > 1 ? rel[0] : null;
  })();

  const { data, error } = parseFrontmatter(content);
  if (error) {
    err(file, error);
    return;
  }

  // 1. name present, kebab-case, matches folder
  if (!data.name) err(file, 'frontmatter missing `name`');
  else {
    if (!KEBAB.test(String(data.name))) err(file, `name "${data.name}" is not kebab-case`);
    if (data.name !== folderName) err(file, `name "${data.name}" does not match folder "${folderName}"`);
    // 4. unique
    if (seenNames.has(data.name)) err(file, `duplicate skill name "${data.name}" (also in ${relative(ROOT, seenNames.get(data.name))})`);
    else seenNames.set(data.name, file);
  }

  // 1+2. description present and within budget
  if (!data.description) err(file, 'frontmatter missing `description`');
  else {
    const len = String(data.description).length + (data.when_to_use ? String(data.when_to_use).length : 0);
    if (len > DESC_BUDGET) err(file, `description (+when_to_use) is ${len} chars, over the ${DESC_BUDGET} budget`);
  }

  // 3. flag types
  for (const flag of ['disable-model-invocation', 'user-invocable']) {
    if (flag in data && typeof data[flag] !== 'boolean') err(file, `\`${flag}\` must be a boolean, got "${data[flag]}"`);
  }
  if ('allowed-tools' in data && !Array.isArray(data['allowed-tools']) && typeof data['allowed-tools'] !== 'string') {
    err(file, '`allowed-tools` must be a list or string');
  }

  // 8. orchestration skills must be manual-only
  if (category && ORCHESTRATION.has(category) && !MODEL_INVOCABLE_EXCEPTIONS.has(data.name)) {
    if (data['disable-model-invocation'] !== true) {
      err(file, `skill in orchestration category "${category}" must set \`disable-model-invocation: true\``);
    }
  }

  // 5. relative markdown links resolve
  for (const match of content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    let target = match[1].trim();
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    target = target.split('#')[0].split('?')[0].trim();
    if (!target) continue;
    const resolved = resolve(folder, target);
    if (!existsSync(resolved)) err(file, `broken link target: ${match[1]}`);
  }

  // 6. supporting-file orphan checks (both directions)
  const mentionsReference = /reference\.md/.test(content);
  const hasReference = existsSync(join(folder, 'reference.md'));
  if (mentionsReference && !hasReference) err(file, 'references `reference.md` but no reference.md exists in the skill folder');
  if (hasReference && !mentionsReference) warn(file, 'reference.md exists but SKILL.md never points to it');

  const scriptsDir = join(folder, 'scripts');
  if (existsSync(scriptsDir)) {
    for (const s of readdirSync(scriptsDir)) {
      if (!content.includes(s)) warn(join(scriptsDir, s), 'script exists but SKILL.md never references it');
    }
  }
}

function validateManifests() {
  const pluginPath = join(ROOT, '.claude-plugin', 'plugin.json');
  const marketplacePath = join(ROOT, '.claude-plugin', 'marketplace.json');

  if (!existsSync(pluginPath)) err(pluginPath, 'missing .claude-plugin/plugin.json');
  else {
    try {
      const plugin = JSON.parse(readFileSync(pluginPath, 'utf8'));
      if (!plugin.name) err(pluginPath, 'plugin.json missing `name`');
    } catch (e) {
      err(pluginPath, `plugin.json does not parse: ${e.message}`);
    }
  }

  if (!existsSync(marketplacePath)) err(marketplacePath, 'missing .claude-plugin/marketplace.json');
  else {
    try {
      const mkt = JSON.parse(readFileSync(marketplacePath, 'utf8'));
      if (!mkt.name) err(marketplacePath, 'marketplace.json missing `name`');
      if (!Array.isArray(mkt.plugins) || mkt.plugins.length === 0) err(marketplacePath, 'marketplace.json has no plugins');
      for (const p of mkt.plugins ?? []) {
        if (typeof p.source === 'string' && p.source.startsWith('.')) {
          if (!existsSync(resolve(ROOT, p.source))) err(marketplacePath, `plugin source path does not exist: ${p.source}`);
        }
      }
    } catch (e) {
      err(marketplacePath, `marketplace.json does not parse: ${e.message}`);
    }
  }
}

// --- run ---
const skillFiles = walk(join(ROOT, 'skills')).filter((f) => basename(f) === 'SKILL.md');
const seenNames = new Map();
for (const file of skillFiles) validateSkill(file, seenNames);
validateManifests();

if (warnings.length) {
  console.log(`\n⚠️  ${warnings.length} warning(s):`);
  for (const w of warnings) console.log(`   - ${w}`);
}

console.log(`\nValidated ${skillFiles.length} skill(s).`);
if (errors.length) {
  console.error(`\n❌ ${errors.length} error(s):`);
  for (const e of errors) console.error(`   - ${e}`);
  process.exit(1);
}
console.log('✅ All checks passed.');
