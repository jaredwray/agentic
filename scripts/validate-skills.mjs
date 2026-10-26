#!/usr/bin/env node
// Validates the agentic skills catalog served by the MCP worker.
// Zero dependencies so CI needs no install step.
//
// Checks:
//  1. Every skills/**/SKILL.md has `name` (kebab-case, matching its folder) and `description`.
//  2. `description` (+ `when_to_use` if present) is <= 1024 characters.
//  3. Flag types are sane (`disable-model-invocation`/`user-invocable` boolean; `allowed-tools` list).
//  4. `name` is unique across the catalog.
//  5. Every relative markdown link inside a SKILL.md resolves to a file that exists.
//  6. Supporting files (`reference.md`, `scripts/*`) are referenced by their SKILL.md, and any
//     `reference.md`/`scripts/` pointer in a SKILL.md resolves to a real file (no orphans either way).
//  7. Orchestration skills set `disable-model-invocation: true` so a mutating/expensive loop
//     never auto-fires. That is every skill under release-ops, security, growth, and
//     project-setup, plus the dependency-management skills at the skills/ root.
//  8. `pnpm publish` / `pnpm stage publish` (and leftover `npm publish`) tarball args in skills/
//     are prefixed with `./`. `pnpm stage publish` of a `.tgz` also passes `--no-git-checks`.
//  9. Skills do not tell agents to `npm stage publish` — pnpm ≥ 11.3 is the staged-publish CLI.
// 10. skills/SKILL.md does not exist — a skill must live in its own folder.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, basename, resolve, relative } from 'node:path';
import { ROOT, SKILLS_DIR, walk, skillMarkdownFiles } from './lib/skill-files.mjs';
import { parseFrontmatter } from './lib/frontmatter.mjs';

const DESC_BUDGET = 1024;
const ORCHESTRATION = new Set(['release-ops', 'security', 'growth', 'project-setup']);
// Used often, so they live at skills/<name>/ (the default one-level scan) instead of a category.
// They are still orchestration skills and stay manual-only.
const ROOT_ORCHESTRATION = new Set(['dependency-management-node', 'dependency-management-rust']);
// Skills in an orchestration category that are genuinely read-only may opt out here.
const MODEL_INVOCABLE_EXCEPTIONS = new Set();

const errors = [];
const warnings = [];
const err = (file, msg) => errors.push(`${relative(ROOT, file)}: ${msg}`);
const warn = (file, msg) => warnings.push(`${relative(ROOT, file)}: ${msg}`);

// Return content with fenced code blocks removed, so prose-only checks don't match inside example
// snippets (e.g. a workflow YAML that runs `./scripts/x.sh` in a TARGET repo). Tracks the opening
// fence length so a 4-backtick wrapper around 3-backtick inner fences closes correctly.
function stripCodeFences(content) {
  const out = [];
  let open = null;
  for (const line of content.split('\n')) {
    const m = line.match(/^\s*(`{3,}|~{3,})/);
    if (m) {
      const f = m[1];
      if (!open) {
        open = { char: f[0], len: f.length };
        continue;
      }
      if (f[0] === open.char && f.length >= open.len) {
        open = null;
        continue;
      }
    }
    if (!open) out.push(line);
  }
  return out.join('\n');
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
  const orchestration =
    (category && ORCHESTRATION.has(category)) || (!category && ROOT_ORCHESTRATION.has(folderName));
  if (orchestration && !MODEL_INVOCABLE_EXCEPTIONS.has(data.name)) {
    if (data['disable-model-invocation'] !== true) {
      const where = category ? `orchestration category "${category}"` : 'the skills/ root';
      err(file, `skill in ${where} must set \`disable-model-invocation: true\``);
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

  // 6. supporting-file orphan check.
  // Pointers to a skill's own reference.md should be written as markdown links, so a missing target
  // is already caught by the broken-link check above. Here we only warn the other direction: a
  // reference.md that exists but is never pointed at from SKILL.md.
  const mentionsReference = /reference\.md/.test(content);
  const hasReference = existsSync(join(folder, 'reference.md'));
  if (hasReference && !mentionsReference) warn(file, 'reference.md exists but SKILL.md never points to it');

  const scriptsDir = join(folder, 'scripts');
  if (existsSync(scriptsDir)) {
    for (const s of readdirSync(scriptsDir)) {
      if (!content.includes(s)) warn(join(scriptsDir, s), 'script exists but SKILL.md never references it');
    }
  }

  // 6b. Bundled-script references. A prose pointer to the skill's own helper is written
  // `./scripts/<file>` (with the leading `./`) and must resolve to a committed file even if no
  // scripts/ dir exists. Bare `scripts/<file>` is intentionally not checked: the ops skills use it
  // to mean a script in the TARGET repo. We scan prose only — `./scripts/x.sh` inside a fenced code
  // block (e.g. a workflow YAML `run:` step) is a target-repo example, not a bundled pointer.
  // (See writing-great-skills for this convention.)
  for (const m of stripCodeFences(content).matchAll(/\.\/scripts\/[A-Za-z0-9._\-/]+/g)) {
    const p = m[0].replace(/[.,;:)\]]+$/, '');
    if (!existsSync(resolve(folder, p))) err(file, `references bundled script that does not exist: ${m[0]}`);
  }
}

// Local tarball args to publish / stage publish must be prefixed with ./. npm 11+ (npa) treats a
// slashed arg without a leading ./ or / as GitHub owner/repo shorthand, so
// `npm stage publish packed/foo.tgz` becomes git ls-remote of packed/foo.tgz.git and dies with
// Permission denied (publickey). pnpm accepts a bare path, but templates keep the prefix so a
// glob is unambiguously a local file.
const SKILL_DOC_EXT = new Set(['.md', '.yml', '.yaml']);

function publishArgSegments(line) {
  const segments = [];
  const re = /(?:npm|pnpm) (?:stage )?publish\b/g;
  let m;
  while ((m = re.exec(line))) {
    const before = line.slice(0, m.index);
    const after = line.slice(m.index + m[0].length);
    const ticksBefore = (before.match(/`/g) || []).length;
    let args = after;
    if (ticksBefore % 2 === 1) {
      const close = after.indexOf('`');
      args = close === -1 ? after : after.slice(0, close);
    }
    segments.push(args);
  }
  return segments;
}

function validatePublishTarballPaths() {
  const skillRoot = join(ROOT, 'skills');
  for (const file of walk(skillRoot)) {
    const ext = file.slice(file.lastIndexOf('.'));
    if (!SKILL_DOC_EXT.has(ext)) continue;
    const content = readFileSync(file, 'utf8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/\bnpm stage publish\b/.test(line)) {
        err(file, `line ${i + 1}: use pnpm stage publish (pnpm ≥ 11.3); do not install the npm CLI for staging`);
      }
      if (/\bpnpm stage publish\b/.test(line) && /\.tgz\b/.test(line) && !/--no-git-checks/.test(line)) {
        err(file, `line ${i + 1}: pnpm stage publish of a tarball must pass --no-git-checks (git-checks run even for a tarball)`);
      }
      for (const args of publishArgSegments(line)) {
        for (const raw of args.split(/\s+/)) {
          const tok = raw.replace(/^['"`]+|['"`]+$/g, '');
          if (!tok || tok.startsWith('-')) continue;
          if (tok.includes('/') && !tok.startsWith('./') && !tok.startsWith('/') && !/^[a-z][a-z0-9+.-]*:/i.test(tok)) {
            err(file, `line ${i + 1}: publish tarball path "${tok}" must be prefixed with ./`);
          }
        }
      }
    }
  }
}

// --- run ---
if (existsSync(join(SKILLS_DIR, 'SKILL.md'))) {
  err(join(SKILLS_DIR, 'SKILL.md'), 'SKILL.md must not sit directly in skills/; each skill needs its own folder');
}
const skillFiles = skillMarkdownFiles();
const seenNames = new Map();
for (const file of skillFiles) validateSkill(file, seenNames);
validatePublishTarballPaths();

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
