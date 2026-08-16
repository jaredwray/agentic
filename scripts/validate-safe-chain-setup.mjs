#!/usr/bin/env node
// Validates the defense-in-depth-nodejs Safe Chain cloud-bootstrap templates and script.
// Zero dependencies. Does not download or install Safe Chain.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKILL = join(ROOT, 'skills/security/defense-in-depth-nodejs');
const SCRIPT = join(SKILL, 'scripts/setup-cloud-environment.sh');
const DEVCONTAINER = join(SKILL, 'templates/.devcontainer/devcontainer.json');
const ENVIRONMENT = join(SKILL, 'templates/.cursor/environment.json');
const AGENTS = join(SKILL, 'templates/AGENTS.md');
const REFERENCE = join(SKILL, 'reference.md');
const BOOTSTRAP = 'bash ./scripts/setup-cloud-environment.sh';
const SHIM_PATH_EXPORT = 'export PATH="$HOME/.safe-chain/shims:$HOME/.safe-chain/bin:$PATH"';

const errors = [];
const err = (msg) => errors.push(msg);

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    err(`${path}: ${e.message}`);
    return null;
  }
}

const devcontainer = readJson(DEVCONTAINER);
if (devcontainer) {
  if (devcontainer.image !== 'mcr.microsoft.com/devcontainers/javascript-node:latest') {
    err('devcontainer.json must use mcr.microsoft.com/devcontainers/javascript-node:latest');
  }
  if (devcontainer.dockerFile || devcontainer.dockerfile || devcontainer.build) {
    err('devcontainer.json must not define a Dockerfile or build');
  }
  if (devcontainer.postCreateCommand !== BOOTSTRAP) {
    err(`devcontainer.json postCreateCommand must be ${BOOTSTRAP}`);
  }
}

const environment = readJson(ENVIRONMENT);
if (environment) {
  if (environment.install !== BOOTSTRAP) {
    err(`environment.json install must be ${BOOTSTRAP}`);
  }
  if (environment.build !== undefined) {
    err('environment.json must not define build');
  }
}

const agents = readFileSync(AGENTS, 'utf8');
if (!/Safe Chain/i.test(agents) || !/never bypass/i.test(agents)) {
  err('templates/AGENTS.md must tell agents never to bypass Safe Chain');
}

const reference = readFileSync(REFERENCE, 'utf8');
if (!reference.includes(BOOTSTRAP)) {
  err(`reference.md must invoke the bootstrap with ${BOOTSTRAP}`);
}
if (!reference.includes(SHIM_PATH_EXPORT)) {
  err('reference.md merge guidance must export Safe Chain shims onto PATH for follow-on commands');
}
if (/`\.\/scripts\/setup-cloud-environment\.sh\s*&&/.test(reference)) {
  err('reference.md must not chain the bootstrap without putting shims on PATH');
}

const script = readFileSync(SCRIPT, 'utf8');
for (const needle of [
  'SAFE_CHAIN_VERSION=',
  'SAFE_CHAIN_INSTALLER_SHA256=',
  'sha256sum -c',
  '--ci',
  'pnpm safe-chain-verify',
  'pnpm install --frozen-lockfile',
  'pnpm-lock.yaml',
]) {
  if (!script.includes(needle)) err(`setup-cloud-environment.sh missing ${needle}`);
}
if (/\|\s*true\b/.test(script) || /\|\s*:(\s|$)/.test(script)) {
  err('setup-cloud-environment.sh must not fall back with || true');
}
if (/curl[^\n]*\|\s*sh/.test(script)) {
  err('setup-cloud-environment.sh must not pipe curl into sh');
}

const dir = mkdtempSync(join(tmpdir(), 'safe-chain-setup-'));
try {
  const result = spawnSync('bash', [SCRIPT], {
    cwd: dir,
    encoding: 'utf8',
    env: { PATH: process.env.PATH, HOME: dir, LANG: 'C' },
  });
  if (result.status === 0) {
    err('setup-cloud-environment.sh must fail closed without pnpm-lock.yaml');
  } else if (!/pnpm-lock\.yaml/.test(`${result.stderr}${result.stdout}`)) {
    err(
      `setup-cloud-environment.sh failed without mentioning pnpm-lock.yaml (status ${result.status}): ${result.stderr || result.stdout}`,
    );
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (errors.length) {
  console.error(`\n❌ ${errors.length} error(s):`);
  for (const e of errors) console.error(`   - ${e}`);
  process.exit(1);
}

console.log('Safe Chain cloud-bootstrap templates and script checks passed.');
