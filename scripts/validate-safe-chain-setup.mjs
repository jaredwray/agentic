#!/usr/bin/env node
// Validates the defense-in-depth-nodejs Safe Chain cloud-bootstrap templates and script.
// Zero dependencies. Does not download or install Safe Chain.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
const scaffoldIdx = reference.indexOf('### DEFENSE_IN_DEPTH.md scaffold');
if (scaffoldIdx === -1) {
  err('reference.md missing DEFENSE_IN_DEPTH.md scaffold');
} else {
  const fence = reference.slice(scaffoldIdx).match(/```md\n([\s\S]*?)```/);
  if (!fence) {
    err('reference.md scaffold missing md fence');
  } else {
    const sections = fence[1].split(/^## /m).filter(Boolean);
    const last = sections.at(-1) ?? '';
    if (!last.startsWith('7. Repository lockdown')) {
      err(`catalog last section must be "## 7. Repository lockdown", got "## ${last.split('\n')[0]}"`);
    }
    if (!last.includes('lockdown-repo.sh')) {
      err('catalog last section must mention lockdown-repo.sh');
    }
    if (!last.includes('Dependabot disabled')) {
      err('catalog last section must require Dependabot disabled');
    }
    if (/Dependabot alerts enabled|Dependabot rule: auto-dismiss/.test(last)) {
      err('catalog last section must not require Dependabot alerts');
    }
    for (const section of sections.slice(0, -1)) {
      if (section.includes('lockdown-repo.sh')) {
        err(`catalog section before last mentions lockdown-repo.sh: ${section.split('\n')[0]}`);
      }
    }
  }
}

const skillMd = readFileSync(join(SKILL, 'SKILL.md'), 'utf8');
if (!/always last/.test(skillMd) || !/lockdown-repo\.sh/.test(skillMd)) {
  err('SKILL.md must say lockdown-repo.sh apply is always last');
}
const priority = skillMd.split('## Item priority')[1]?.split(/^## /m)[0] ?? '';
const lastPriority = [...priority.matchAll(/^\d+\. \*\*§ \d+[^*]*\*\*/gm)].at(-1)?.[0] ?? '';
if (!/§ 7 Repository lockdown/.test(lastPriority)) {
  err(`SKILL.md Item priority last item must be § 7 Repository lockdown, got "${lastPriority}"`);
}

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

const lockdown = readFileSync(join(SKILL, 'scripts/lockdown-repo.sh'), 'utf8');
if (!lockdown.includes('UPSTREAM_REPO="jaredwray/agentic"')) {
  err('lockdown-repo.sh must compare itself to jaredwray/agentic');
}
if (!lockdown.includes('warning: this lockdown-repo.sh is not the latest')) {
  err('lockdown-repo.sh must warn when it is not the latest copy');
}
if (!/check_upstream_script/.test(lockdown)) {
  err('lockdown-repo.sh must call check_upstream_script');
}
const lockdownSyntax = spawnSync('bash', ['-n', join(SKILL, 'scripts/lockdown-repo.sh')], {
  encoding: 'utf8',
});
if (lockdownSyntax.status !== 0) {
  err(`lockdown-repo.sh failed bash -n: ${lockdownSyntax.stderr || lockdownSyntax.stdout}`);
}
if (!lockdown.includes('-X DELETE "repos/$REPO/vulnerability-alerts"')) {
  err('lockdown-repo.sh must disable Dependabot alerts');
}

const lockdownPath = join(SKILL, 'scripts/lockdown-repo.sh');
const lockdownHelp = spawnSync('bash', [lockdownPath, '--help'], { encoding: 'utf8' });
if (lockdownHelp.status !== 0) {
  err(`lockdown-repo.sh --help exited ${lockdownHelp.status}`);
} else if (/warning:/.test(`${lockdownHelp.stdout}${lockdownHelp.stderr}`)) {
  err('lockdown-repo.sh --help must not check upstream (would require network)');
}

const upstreamDir = mkdtempSync(join(tmpdir(), 'lockdown-upstream-'));
try {
  const fakeGh = join(upstreamDir, 'gh');
  writeFileSync(
    fakeGh,
    `#!/bin/sh
if printf '%s' "$*" | grep -q 'application/vnd.github.raw'; then
  printf 'not-the-real-lockdown-repo.sh\\n'
  exit 0
fi
exit 1
`,
    { mode: 0o755 },
  );
  const stale = spawnSync('bash', [lockdownPath], {
    encoding: 'utf8',
    env: { PATH: `${upstreamDir}:${process.env.PATH}`, LANG: 'C', HOME: upstreamDir },
  });
  const staleOut = `${stale.stdout}${stale.stderr}`;
  if (!/not the latest from jaredwray\/agentic/.test(staleOut)) {
    err(`lockdown-repo.sh must warn when it differs from upstream (got: ${staleOut})`);
  }

  writeFileSync(
    fakeGh,
    `#!/bin/sh
if printf '%s' "$*" | grep -q 'application/vnd.github.raw'; then
  cat '${lockdownPath.replace(/'/g, `'\\''`)}'
  exit 0
fi
exit 1
`,
    { mode: 0o755 },
  );
  const current = spawnSync('bash', [lockdownPath], {
    encoding: 'utf8',
    env: { PATH: `${upstreamDir}:${process.env.PATH}`, LANG: 'C', HOME: upstreamDir },
  });
  const currentOut = `${current.stdout}${current.stderr}`;
  if (/not the latest from jaredwray\/agentic/.test(currentOut)) {
    err(`lockdown-repo.sh must not warn when it matches upstream (got: ${currentOut})`);
  }

  writeFileSync(fakeGh, '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  const offline = spawnSync('bash', [lockdownPath], {
    encoding: 'utf8',
    env: { PATH: `${upstreamDir}:${process.env.PATH}`, LANG: 'C', HOME: upstreamDir },
  });
  const offlineOut = `${offline.stdout}${offline.stderr}`;
  if (!/could not verify this lockdown-repo\.sh is the latest/.test(offlineOut)) {
    err(`lockdown-repo.sh must warn and continue when upstream is unreachable (got: ${offlineOut})`);
  }
  if (/not the latest from jaredwray\/agentic/.test(offlineOut)) {
    err(`lockdown-repo.sh must not claim it is stale when upstream could not be fetched (got: ${offlineOut})`);
  }
} finally {
  rmSync(upstreamDir, { recursive: true, force: true });
}
if (!lockdown.includes('-X DELETE "repos/$REPO/automated-security-fixes"')) {
  err('lockdown-repo.sh must disable Dependabot security updates');
}
if (lockdown.includes('-X PUT "repos/$REPO/vulnerability-alerts"')) {
  err('lockdown-repo.sh must not enable Dependabot alerts');
}
if (!lockdown.includes('-X PUT "repos/$REPO/immutable-releases"')) {
  err('lockdown-repo.sh must enable immutable releases');
}

const forkStepIdx = lockdown.indexOf('step 2 "Workflow run approval for fork PRs"');
if (forkStepIdx === -1) {
  err('lockdown-repo.sh must have step 2 Workflow run approval for fork PRs');
} else {
  const nextStepIdx = lockdown.indexOf('\nstep 3 ', forkStepIdx);
  const forkStep = lockdown.slice(forkStepIdx, nextStepIdx === -1 ? undefined : nextStepIdx);
  if (!forkStep.includes('[[ "$PRIVATE" == "true" ]]')) {
    err('lockdown-repo.sh must skip fork-PR approval when the repo is private');
  }
  if (!forkStep.includes('public repos only')) {
    err('lockdown-repo.sh must explain that fork-PR approval is public-repos-only');
  }
  if (!forkStep.includes('fork-pr-contributor-approval')) {
    err('lockdown-repo.sh must set fork-PR approval on public repos');
  }
}

function writeLockdownGhStub(dir, { privateRepo, callLog, lockdownPath }) {
  const escapedPath = lockdownPath.replace(/'/g, `'\\''`);
  const escapedLog = callLog.replace(/'/g, `'\\''`);
  writeFileSync(
    join(dir, 'gh'),
    `#!/bin/sh
printf '%s\\n' "$*" >> '${escapedLog}'
jq=""
prev=""
path=""
for a in "$@"; do
  if [ "$prev" = "--jq" ]; then jq=$a; fi
  case "$a" in
    repos/*) path=$a ;;
  esac
  prev=$a
done
case "$path" in
  repos/jaredwray/agentic/contents/*)
    cat '${escapedPath}'
    exit 0
    ;;
  repos/owner/test)
    case "$jq" in
      .full_name) printf 'owner/test\\n'; exit 0 ;;
      .private) printf '${privateRepo ? 'true' : 'false'}\\n'; exit 0 ;;
      .default_branch) printf 'main\\n'; exit 0 ;;
      .owner.type) printf 'User\\n'; exit 0 ;;
      .owner.id) printf '1\\n'; exit 0 ;;
      '.permissions.admin // false') printf 'true\\n'; exit 0 ;;
    esac
    exit 1
    ;;
  *fork-pr-contributor-approval*)
    printf 'all_external_contributors\\n'
    exit 0
    ;;
esac
exit 1
`,
    { mode: 0o755 },
  );
}

const forkDir = mkdtempSync(join(tmpdir(), 'lockdown-fork-skip-'));
try {
  const privateLog = join(forkDir, 'private-calls.log');
  const publicLog = join(forkDir, 'public-calls.log');
  writeLockdownGhStub(forkDir, {
    privateRepo: true,
    callLog: privateLog,
    lockdownPath,
  });
  const privateCheck = spawnSync('bash', [lockdownPath, 'owner/test', '--check'], {
    encoding: 'utf8',
    env: { PATH: `${forkDir}:${process.env.PATH}`, LANG: 'C', HOME: forkDir },
  });
  const privateOut = `${privateCheck.stdout}${privateCheck.stderr}`;
  const privateCalls = readFileSync(privateLog, 'utf8');
  if (!/skipped: public repos only — GitHub does not allow fork PR approval on private repositories/.test(privateOut)) {
    err(`lockdown-repo.sh --check on a private repo must skip fork-PR approval (got: ${privateOut})`);
  }
  if (/want approval_policy=all_external_contributors/.test(privateOut)) {
    err(`lockdown-repo.sh --check on a private repo must not fail fork-PR approval (got: ${privateOut})`);
  }
  if (privateCalls.includes('fork-pr-contributor-approval')) {
    err('lockdown-repo.sh must not call the fork-PR approval API on a private repo');
  }

  writeLockdownGhStub(forkDir, {
    privateRepo: false,
    callLog: publicLog,
    lockdownPath,
  });
  const publicCheck = spawnSync('bash', [lockdownPath, 'owner/test', '--check'], {
    encoding: 'utf8',
    env: { PATH: `${forkDir}:${process.env.PATH}`, LANG: 'C', HOME: forkDir },
  });
  const publicOut = `${publicCheck.stdout}${publicCheck.stderr}`;
  const publicCalls = readFileSync(publicLog, 'utf8');
  if (/skipped: public repos only — GitHub does not allow fork PR approval on private repositories/.test(publicOut)) {
    err(`lockdown-repo.sh --check on a public repo must not skip fork-PR approval (got: ${publicOut})`);
  }
  if (!publicCalls.includes('fork-pr-contributor-approval')) {
    err('lockdown-repo.sh must call the fork-PR approval API on a public repo');
  }
} finally {
  rmSync(forkDir, { recursive: true, force: true });
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
