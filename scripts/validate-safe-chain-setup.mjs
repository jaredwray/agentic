#!/usr/bin/env node
// Validates the defense-in-depth-nodejs Safe Chain cloud-bootstrap templates and script.
// Zero dependencies. Does not download or install Safe Chain.

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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
const GITHUB_CLI_FEATURE = 'ghcr.io/devcontainers/features/github-cli:1';
const DOCKER_IN_DOCKER_FEATURE = 'ghcr.io/devcontainers/features/docker-in-docker:4';
const IMAGE_PIN_RE =
  /^mcr\.microsoft\.com\/devcontainers\/javascript-node:\d+\.\d+\.\d+-[^:@]+@sha256:[a-f0-9]{64}$/;

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
  if (!IMAGE_PIN_RE.test(devcontainer.image)) {
    err(
      'devcontainer.json image must be a versioned mcr.microsoft.com/devcontainers/javascript-node tag pinned by sha256 digest',
    );
  }
  if (/:latest(?:@|$)/.test(devcontainer.image)) {
    err('devcontainer.json must not use the latest tag');
  }
  if (devcontainer.dockerFile || devcontainer.dockerfile || devcontainer.build) {
    err('devcontainer.json must not define a Dockerfile or build');
  }
  if (devcontainer.postCreateCommand !== BOOTSTRAP) {
    err(`devcontainer.json postCreateCommand must be ${BOOTSTRAP}`);
  }
  if (/bash\s+-i|nvm\.sh|source ~\/\.bashrc/.test(String(devcontainer.postCreateCommand))) {
    err('devcontainer.json must not source nvm or bashrc; the bootstrap script handles that');
  }
  const features = devcontainer.features ?? {};
  if (!Object.hasOwn(features, GITHUB_CLI_FEATURE)) {
    err(`devcontainer.json must install ${GITHUB_CLI_FEATURE}`);
  }
  if (!Object.hasOwn(features, DOCKER_IN_DOCKER_FEATURE)) {
    err(`devcontainer.json must install ${DOCKER_IN_DOCKER_FEATURE}`);
  } else if (features[DOCKER_IN_DOCKER_FEATURE]?.moby !== false) {
    err('devcontainer.json docker-in-docker must set moby: false (Trixie has no Moby packages)');
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
    if (!/never committed/.test(last) || !/repo admin/.test(last)) {
      err('catalog last section must say a repo admin applies lockdown-repo.sh and never commits it');
    }
    const lastItem = [...last.matchAll(/^- \[ \] .+$/gm)].at(-1)?.[0] ?? '';
    if (!lastItem.includes('lockdown-repo.sh')) {
      err(`catalog last item must be lockdown-repo.sh, got "${lastItem}"`);
    }
    if (!last.includes('Dependabot disabled')) {
      err('catalog last section must require Dependabot disabled');
    }
    const cloud = sections.find((s) => s.startsWith('2. CODEOWNERS')) ?? '';
    if (!/allowAutomaticTasks/.test(cloud) || !/\(manual\)/.test(cloud)) {
      err('catalog § 2 must require task.allowAutomaticTasks off or prompt as (manual)');
    }
    if (!/\/\.vscode\//.test(cloud)) {
      err('catalog § 2 CODEOWNERS must cover /.vscode/');
    }
    if (!/pinned by digest/.test(cloud)) {
      err('catalog § 2 must require Dev Container image digest pinning');
    }
    const actions = sections.find((s) => s.startsWith('4. GitHub Actions')) ?? '';
    if (!/no spaces/.test(actions) || !/kebab-case/.test(actions)) {
      err('catalog § 4 must require kebab-case workflow/job names with no spaces');
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
if (!/never (?:checked|copy|commit)/i.test(skillMd) || !/lockdown-repo\.sh/.test(skillMd)) {
  err('SKILL.md must say lockdown-repo.sh is never checked into a repo');
}
if (!/admin runs (?:apply|it) last/i.test(skillMd)) {
  err('SKILL.md must say a repo admin runs lockdown-repo.sh last');
}
if (!/\(manual\).*last/is.test(skillMd)) {
  err('SKILL.md must say all (manual) tasks are last with lockdown');
}
if (/do not block/i.test(skillMd)) {
  err('SKILL.md must not say (manual) items do not block lockdown');
}
if (!/defense-devcontainer-pin/.test(skillMd) || !/digest-pinned Dev Container/.test(skillMd)) {
  err('SKILL.md must include the Dev Container digest-pin item');
}
if (!/automatic tasks/.test(skillMd) || !/allowAutomaticTasks/.test(reference)) {
  err('SKILL.md and reference.md must require turning off VS Code / Cursor automatic tasks');
}
if (!reference.includes('/.vscode/ {{OWNERS}}')) {
  err('CODEOWNERS template must cover /.vscode/');
}
if (!reference.includes('opensourcemalware.com/blog/how-malware-abuses-npm-lifecycle-scripts-and-vs-code-tasks')) {
  err('reference.md must cite How Malware Abuses NPM Lifecycle Scripts and VS Code Tasks');
}
const codeowners = readFileSync(join(ROOT, '.github/CODEOWNERS'), 'utf8');
if (!codeowners.includes('/.vscode/')) {
  err('.github/CODEOWNERS must cover /.vscode/');
}
const priority = skillMd.split('## Item priority')[1]?.split(/^## /m)[0] ?? '';
const lastPriority = [...priority.matchAll(/^\d+\. \*\*§ \d+[^*]*\*\*/gm)].at(-1)?.[0] ?? '';
if (!/§ 7 Repository lockdown/.test(lastPriority)) {
  err(`SKILL.md Item priority last item must be § 7 Repository lockdown, got "${lastPriority}"`);
}
if (/do not block/i.test(reference)) {
  err('reference.md must not say (manual) items do not block lockdown');
}
if (!/Never copy or commit/.test(reference) || !/admin runs it last/.test(reference)) {
  err('reference.md must say lockdown-repo.sh is never committed and a repo admin runs it last');
}

if (!reference.includes(BOOTSTRAP)) {
  err(`reference.md must invoke the bootstrap with ${BOOTSTRAP}`);
}
if (!reference.includes('--install-directory') || !reference.includes('~/.safe-chain/bin')) {
  err('reference.md must document Corepack --install-directory into ~/.safe-chain/bin');
}
if (!reference.includes('.nvmrc') || !reference.includes('from `/`')) {
  err('reference.md must document running the installer from / so .nvmrc cannot break NVM');
}
if (!/"moby": false/.test(reference)) {
  err('reference.md must set docker-in-docker moby: false');
}
if (/bash\s+-i/.test(reference) && !/do not wrap/.test(reference)) {
  err('reference.md must not recommend bash -i for postCreateCommand');
}
if (!reference.includes(GITHUB_CLI_FEATURE)) {
  err(`reference.md must mention ${GITHUB_CLI_FEATURE}`);
}
if (!reference.includes(DOCKER_IN_DOCKER_FEATURE)) {
  err(`reference.md must mention ${DOCKER_IN_DOCKER_FEATURE}`);
}
if (!/@sha256:/.test(reference) || !/7-day age gate/.test(reference)) {
  err('reference.md must pin Dev Container images by digest under a 7-day age gate');
}
if (/javascript-node:latest/.test(reference)) {
  err('reference.md must not recommend javascript-node:latest');
}

for (const [label, rel] of [
  ['dependency-management-node', 'skills/release-ops/dependency-management-node/SKILL.md'],
  ['dependency-management-rust', 'skills/release-ops/dependency-management-rust/SKILL.md'],
]) {
  const dep = readFileSync(join(ROOT, rel), 'utf8');
  if (!/Dev Container images/.test(dep) || !/7-day age gate/.test(dep) || !/chore\/devcontainer-images/.test(dep)) {
    err(`${label} must refresh Dev Container image pins under a 7-day age gate`);
  }
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
  '--install-directory',
  'cd /',
]) {
  if (!script.includes(needle)) err(`setup-cloud-environment.sh missing ${needle}`);
}
if (!/^export SAFE_CHAIN_VERSION=/m.test(script)) {
  err('setup-cloud-environment.sh must export SAFE_CHAIN_VERSION for the installer child process');
}
if (!/corepack enable --install-directory "\$SAFE_CHAIN_BIN" pnpm/.test(script)) {
  err('setup-cloud-environment.sh must enable Corepack pnpm into SAFE_CHAIN_BIN');
}
if (script.includes('unset NVM_DIR')) {
  err('setup-cloud-environment.sh must not unset NVM_DIR; cd / so .nvmrc cannot break the installer');
}
if (/sudo\s+.*corepack/.test(script)) {
  err('setup-cloud-environment.sh must not sudo corepack; use --install-directory');
}
if (/set \+euo pipefail/.test(script) || /\.\s+"\$nvm_script"/.test(script) || /source .*nvm\.sh/.test(script)) {
  err('setup-cloud-environment.sh must not source nvm.sh; run the installer from / instead');
}
if (script.includes('.local/bin')) {
  err('setup-cloud-environment.sh must put Corepack shims in SAFE_CHAIN_BIN, not ~/.local/bin');
}
if (/\|\s*true\b/.test(script) || /\|\s*:(\s|$)/.test(script)) {
  err('setup-cloud-environment.sh must not fall back with || true');
}
if (/curl[^\n]*\|\s*sh/.test(script)) {
  err('setup-cloud-environment.sh must not pipe curl into sh');
}
const scriptSyntax = spawnSync('bash', ['-n', SCRIPT], { encoding: 'utf8' });
if (scriptSyntax.status !== 0) {
  err(`setup-cloud-environment.sh failed bash -n: ${scriptSyntax.stderr || scriptSyntax.stdout}`);
}

const lockdown = readFileSync(join(SKILL, 'scripts/lockdown-repo.sh'), 'utf8');
if (!/NEVER check this file into a target repo/.test(lockdown)) {
  err('lockdown-repo.sh must say it is never checked into a target repo');
}
if (!/repo admin runs it last/.test(lockdown)) {
  err('lockdown-repo.sh must say a repo admin runs it last');
}
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
} else if (!/must not contain spaces/.test(lockdownHelp.stdout)) {
  err('lockdown-repo.sh --help must say required-check names must not contain spaces');
}

const spaceChecks = spawnSync('bash', [lockdownPath, '--required-checks', 'foo bar'], {
  encoding: 'utf8',
});
const spaceOut = `${spaceChecks.stdout}${spaceChecks.stderr}`;
if (spaceChecks.status === 0) {
  err('lockdown-repo.sh must reject --required-checks names that contain spaces');
} else if (!/must not contain spaces/.test(spaceOut)) {
  err(`lockdown-repo.sh space rejection message missing (got: ${spaceOut})`);
}

function spacedWorkflowOrJobNames(md) {
  const bad = [];
  for (const [, body] of md.matchAll(/```ya?ml\n([\s\S]*?)```/g)) {
    if (!/^name:/m.test(body) && !/^on:/m.test(body) && !/^jobs:/m.test(body)) continue;
    const wm = body.match(/^name:\s*(.+)$/m);
    if (wm) {
      const n = wm[1].trim().replace(/^['"]|['"]$/g, '');
      if (/\s/.test(n)) bad.push(n);
    }
    for (const jm of body.matchAll(/^ {4}name:\s*(.+)$/gm)) {
      const n = jm[1].trim().replace(/^['"]|['"]$/g, '');
      if (/\s/.test(n)) bad.push(n);
    }
  }
  return bad;
}

const spacedRef = spacedWorkflowOrJobNames(reference);
if (spacedRef.length) {
  err(`reference.md workflow/job names must not contain spaces: ${spacedRef.join(', ')}`);
}

const releaseRef = readFileSync(join(ROOT, 'skills/release-ops/release-management-nodejs/reference.md'), 'utf8');
const spacedRelease = spacedWorkflowOrJobNames(releaseRef);
if (spacedRelease.length) {
  err(`release-management reference.md workflow/job names must not contain spaces: ${spacedRelease.join(', ')}`);
}

const wfDir = join(ROOT, '.github/workflows');
for (const file of readdirSync(wfDir)) {
  if (!/\.ya?ml$/.test(file)) continue;
  const text = readFileSync(join(wfDir, file), 'utf8');
  const m = text.match(/^name:\s*(.+)$/m);
  if (!m) {
    err(`.github/workflows/${file}: workflow missing name:`);
    continue;
  }
  const name = m[1].trim().replace(/^['"]|['"]$/g, '');
  if (/\s/.test(name)) {
    err(`.github/workflows/${file}: workflow name "${name}" must not contain spaces`);
  }
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

function writeExec(dir, name, body) {
  writeFileSync(join(dir, name), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
}

function runBootstrap({ home, cwd, pathDir, extraEnv = {} }) {
  return spawnSync('bash', [SCRIPT], {
    cwd,
    encoding: 'utf8',
    env: {
      PATH: `${pathDir}:/usr/bin:/bin`,
      HOME: home,
      LANG: 'C',
      ...extraEnv,
    },
  });
}

const nvmDir = mkdtempSync(join(tmpdir(), 'safe-chain-nvm-'));
try {
  const home = join(nvmDir, 'home');
  mkdirSync(home, { recursive: true });
  writeFileSync(join(nvmDir, 'pnpm-lock.yaml'), '');
  writeFileSync(join(nvmDir, 'package.json'), JSON.stringify({ name: 'x' }));
  writeFileSync(join(nvmDir, '.nvmrc'), 'v99.0.0\n');
  const bin = join(nvmDir, 'bin');
  mkdirSync(bin);
  writeExec(bin, 'pnpm', 'exit 0');
  writeExec(
    bin,
    'curl',
    `out=""
prev=""
for a in "$@"; do
  if [ "$prev" = "-o" ]; then out=$a; fi
  prev=$a
done
printf '%s\\n' '#!/bin/sh
if [ -f .nvmrc ]; then
  echo "installer ran in repo" >&2
  exit 3
fi
mkdir -p "$HOME/.safe-chain/shims" "$HOME/.safe-chain/bin"
exit 0' > "$out"`,
  );
  writeExec(bin, 'sha256sum', 'exit 0');
  const result = runBootstrap({
    home,
    cwd: nvmDir,
    pathDir: bin,
    extraEnv: { NVM_DIR: '/tmp/fake-nvm' },
  });
  const out = `${result.stderr}${result.stdout}`;
  if (result.status !== 0) {
    err(`setup-cloud-environment.sh must run the installer from / so .nvmrc cannot abort it (got ${result.status}: ${out})`);
  }
} finally {
  rmSync(nvmDir, { recursive: true, force: true });
}

const corepackDir = mkdtempSync(join(tmpdir(), 'safe-chain-corepack-'));
try {
  const home = join(corepackDir, 'home');
  mkdirSync(home, { recursive: true });
  writeFileSync(join(corepackDir, 'pnpm-lock.yaml'), '');
  writeFileSync(
    join(corepackDir, 'package.json'),
    JSON.stringify({ name: 'x', packageManager: 'pnpm@11.3.0' }),
  );
  const bin = join(corepackDir, 'bin');
  mkdirSync(bin);
  const log = join(corepackDir, 'corepack.log');
  writeExec(
    bin,
    'corepack',
    `printf '%s\\n' "$*" >> '${log.replace(/'/g, `'\\''`)}'
prev=""
for a in "$@"; do
  if [ "$prev" = "--install-directory" ]; then
    mkdir -p "$a"
    exit 0
  fi
  prev=$a
done
echo 'Error: EACCES: permission denied, symlink ../lib/node_modules/corepack/dist/pnpm.js -> /usr/local/bin/pnpm' >&2
exit 1`,
  );
  const result = runBootstrap({ home, cwd: corepackDir, pathDir: bin });
  const out = `${result.stderr}${result.stdout}`;
  const logged = readFileSync(log, 'utf8');
  if (!logged.includes('--install-directory') || !logged.includes('.safe-chain/bin') || !/\bpnpm\b/.test(logged)) {
    err(`setup-cloud-environment.sh must enable Corepack pnpm into ~/.safe-chain/bin (got: ${logged || out})`);
  }
  if (logged.includes('.local/bin')) {
    err('setup-cloud-environment.sh must not install Corepack shims into ~/.local/bin');
  }
  if (result.status === 0) {
    err('setup-cloud-environment.sh must not succeed without pnpm after corepack enable');
  } else if (!/pnpm is required/.test(out)) {
    err(
      `setup-cloud-environment.sh must not abort on corepack EACCES; must reach the pnpm check (got ${result.status}: ${out})`,
    );
  }
} finally {
  rmSync(corepackDir, { recursive: true, force: true });
}

const skipCorepackDir = mkdtempSync(join(tmpdir(), 'safe-chain-skip-corepack-'));
try {
  const home = join(skipCorepackDir, 'home');
  mkdirSync(home, { recursive: true });
  writeFileSync(join(skipCorepackDir, 'pnpm-lock.yaml'), '');
  writeFileSync(
    join(skipCorepackDir, 'package.json'),
    JSON.stringify({ name: 'x', packageManager: 'pnpm@11.3.0' }),
  );
  const bin = join(skipCorepackDir, 'bin');
  mkdirSync(bin);
  const log = join(skipCorepackDir, 'corepack.log');
  writeFileSync(log, '');
  writeExec(bin, 'pnpm', 'exit 0');
  writeExec(bin, 'corepack', `printf '%s\\n' "$*" >> '${log.replace(/'/g, `'\\''`)}'; exit 1`);
  writeExec(
    bin,
    'curl',
    `out=""
prev=""
for a in "$@"; do
  if [ "$prev" = "-o" ]; then out=$a; fi
  prev=$a
done
printf '%s\\n' '#!/bin/sh
mkdir -p "$HOME/.safe-chain/shims" "$HOME/.safe-chain/bin"
exit 0' > "$out"`,
  );
  writeExec(bin, 'sha256sum', 'exit 0');
  const result = runBootstrap({ home, cwd: skipCorepackDir, pathDir: bin });
  const out = `${result.stderr}${result.stdout}`;
  if (result.status !== 0) {
    err(`setup-cloud-environment.sh must skip corepack when pnpm is already on PATH (got ${result.status}: ${out})`);
  }
  if (readFileSync(log, 'utf8').trim() !== '') {
    err('setup-cloud-environment.sh must not call corepack enable when pnpm is already on PATH');
  }
} finally {
  rmSync(skipCorepackDir, { recursive: true, force: true });
}

const checkNpmjsPath = join(SKILL, 'scripts/check-npmjs.sh');
const checkNpmjs = readFileSync(checkNpmjsPath, 'utf8');
if (!/NEVER check this file into a target repo/.test(checkNpmjs)) {
  err('check-npmjs.sh must say it is never checked into a target repo');
}
if (!/Check-only/.test(checkNpmjs) || /never applies settings/.test(checkNpmjs) === false) {
  err('check-npmjs.sh must be check-only and must say it never applies settings');
}
if (!checkNpmjs.includes('UPSTREAM_REPO="jaredwray/agentic"')) {
  err('check-npmjs.sh must compare itself to jaredwray/agentic');
}
if (!checkNpmjs.includes('warning: this check-npmjs.sh is not the latest')) {
  err('check-npmjs.sh must warn when it is not the latest copy');
}
if (!/check_upstream_script/.test(checkNpmjs)) {
  err('check-npmjs.sh must call check_upstream_script');
}
if (!checkNpmjs.includes('createStagedPackage') || !checkNpmjs.includes('createPackage')) {
  err('check-npmjs.sh must require stage-only trusted publisher permissions');
}
if (/TOKEN="\$NPM_TOKEN"/.test(checkNpmjs) || /or set NPM_TOKEN/.test(checkNpmjs)) {
  err('check-npmjs.sh must not accept NPM_TOKEN as auth');
}
if (!checkNpmjs.includes('NPM_TOKEN is not allowed')) {
  err('check-npmjs.sh must reject NPM_TOKEN');
}
const checkNpmjsSyntax = spawnSync('bash', ['-n', checkNpmjsPath], { encoding: 'utf8' });
if (checkNpmjsSyntax.status !== 0) {
  err(`check-npmjs.sh failed bash -n: ${checkNpmjsSyntax.stderr || checkNpmjsSyntax.stdout}`);
}

if (!/check-npmjs\.sh/.test(skillMd) || !/never copy it into the target repo/i.test(skillMd)) {
  err('SKILL.md must tell the agent to run check-npmjs.sh and never copy it into the target repo');
}
if (!/NPM_TOKEN`? is not allowed/.test(skillMd)) {
  err('SKILL.md must say NPM_TOKEN is not allowed for check-npmjs.sh');
}
if (!/check-npmjs\.sh/.test(reference) || !/Never copy or commit it into the/.test(reference)) {
  err('reference.md must document check-npmjs.sh and say it is never copied into the target');
}
if (!/createStagedPackage/.test(reference) || !/legacy/.test(reference)) {
  err('reference.md must require createStagedPackage-only permissions and treat legacy configs as fail');
}
if (/or NPM_TOKEN/.test(reference) || !/NPM_TOKEN is not allowed/.test(reference)) {
  err('reference.md must require npm login and must not offer NPM_TOKEN');
}

const checkNpmjsHelp = spawnSync('bash', [checkNpmjsPath, '--help'], { encoding: 'utf8' });
if (checkNpmjsHelp.status !== 0) {
  err(`check-npmjs.sh --help exited ${checkNpmjsHelp.status}`);
} else if (/warning:/.test(`${checkNpmjsHelp.stdout}${checkNpmjsHelp.stderr}`)) {
  err('check-npmjs.sh --help must not check upstream (would require network)');
} else if (!/Never check this file into a target repo/.test(checkNpmjsHelp.stdout)) {
  err('check-npmjs.sh --help must say it is never checked into a target repo');
} else if (/or NPM_TOKEN/.test(checkNpmjsHelp.stdout) || !/NPM_TOKEN is not allowed/.test(checkNpmjsHelp.stdout)) {
  err('check-npmjs.sh --help must require npm login and must not offer NPM_TOKEN');
}

const workflowSpace = spawnSync('bash', [checkNpmjsPath, '--workflow', 'foo bar'], { encoding: 'utf8' });
if (workflowSpace.status === 0 || !/must not contain spaces/.test(`${workflowSpace.stdout}${workflowSpace.stderr}`)) {
  err('check-npmjs.sh must reject --workflow names that contain spaces');
}
const workflowPath = spawnSync('bash', [checkNpmjsPath, '--workflow', '.github/workflows/release.yaml'], {
  encoding: 'utf8',
});
if (workflowPath.status === 0 || !/must be a filename/.test(`${workflowPath.stdout}${workflowPath.stderr}`)) {
  err('check-npmjs.sh must reject --workflow paths');
}
const repoAsPkg = spawnSync('bash', [checkNpmjsPath, 'owner/repo'], { encoding: 'utf8' });
if (repoAsPkg.status === 0 || !/looks like owner\/repo/.test(`${repoAsPkg.stdout}${repoAsPkg.stderr}`)) {
  err('check-npmjs.sh must reject owner/repo as a package name');
}

function writeCheckNpmjsCurl(dir, { mode, scriptPath, callLog }) {
  const escapedScript = scriptPath.replace(/'/g, `'\\''`);
  const escapedLog = callLog.replace(/'/g, `'\\''`);
  writeFileSync(
    join(dir, 'curl'),
    `#!/bin/sh
printf '%s\\n' "$*" >> '${escapedLog}'
out=""
prev=""
url=""
for a in "$@"; do
  if [ "$prev" = "-o" ]; then out=$a; fi
  case "$a" in
    http*) url=$a ;;
  esac
  prev=$a
done
args="$*"
if printf '%s' "$args" | grep -q 'application/vnd.github.raw'; then
  if [ "${mode}" = stale ]; then
    printf 'not-the-real-check-npmjs.sh\\n' > "$out"
    exit 0
  fi
  if [ "${mode}" = offline ]; then
    exit 1
  fi
  if [ -n "$out" ]; then cat '${escapedScript}' > "$out"; else cat '${escapedScript}'; fi
  exit 0
fi
code=200
body='{}'
case "$url" in
  */-/package/keyv/trust|*/-/package/@scope%2Fpkg/trust)
    if [ "${mode}" = publish ]; then
      body='[{"id":"abc","type":"github","claims":{"repository":"owner/test","workflow_ref":{"file":"release.yaml"}},"permissions":["createPackage"]}]'
    elif [ "${mode}" = legacy ]; then
      body='[{"id":"abc","type":"github","claims":{"repository":"owner/test","workflow_ref":{"file":"release.yaml"}}}]'
    else
      body='[{"id":"abc","type":"github","claims":{"repository":"owner/test","workflow_ref":{"file":"release.yaml"}},"permissions":["createStagedPackage"]}]'
    fi
    ;;
  */-/package/keyv/access|*/-/package/@scope%2Fpkg/access)
    if [ "${mode}" = mfa ]; then
      body='{"publish_requires_tfa":true,"automation_token_overrides_tfa":false}'
      code=200
    else
      body='{"code":"MethodNotAllowedError"}'
      code=405
    fi
    ;;
  */-/package/keyv/visibility|*/-/package/@scope%2Fpkg/visibility)
    body='{"public":true}'
    ;;
  */keyv|*/@scope%2Fpkg)
    body='{"repository":{"type":"git","url":"git+https://github.com/owner/test.git"}}'
    ;;
  *)
    body='{}'
    code=404
    ;;
esac
if [ -n "$out" ]; then
  printf '%s' "$body" > "$out"
  printf '%s' "$code"
else
  printf '%s' "$body"
fi
exit 0
`,
    { mode: 0o755 },
  );
}

function writeCheckNpmjsNpm(dir, { token = 'npm_session_test' } = {}) {
  writeFileSync(
    join(dir, 'npm'),
    `#!/bin/sh
if [ "$1" = "config" ] && [ "$2" = "get" ]; then
  printf '%s\\n' '${token}'
  exit 0
fi
exit 1
`,
    { mode: 0o755 },
  );
}

const npmjsDir = mkdtempSync(join(tmpdir(), 'check-npmjs-'));
try {
  const env = { PATH: `${npmjsDir}:${process.env.PATH}`, LANG: 'C', HOME: npmjsDir };
  const run = (args, extraEnv = {}) =>
    spawnSync('bash', [checkNpmjsPath, ...args], {
      encoding: 'utf8',
      env: { ...env, ...extraEnv },
    });
  writeCheckNpmjsNpm(npmjsDir);
  writeCheckNpmjsCurl(npmjsDir, {
    mode: 'pass',
    scriptPath: checkNpmjsPath,
    callLog: join(npmjsDir, 'pass.log'),
  });

  const tokenRun = run(['keyv', '--repo', 'owner/test', '--workflow', 'release.yaml'], {
    NPM_TOKEN: 'npm_test',
  });
  const tokenOut = `${tokenRun.stdout}${tokenRun.stderr}`;
  if (tokenRun.status === 0 || !/NPM_TOKEN is not allowed/.test(tokenOut)) {
    err(`check-npmjs.sh must reject NPM_TOKEN (got ${tokenRun.status}: ${tokenOut})`);
  }

  writeCheckNpmjsNpm(npmjsDir, { token: 'undefined' });
  const noLoginRun = run(['keyv', '--repo', 'owner/test', '--workflow', 'release.yaml']);
  const noLoginOut = `${noLoginRun.stdout}${noLoginRun.stderr}`;
  if (noLoginRun.status === 0 || !/no npm login session/.test(noLoginOut)) {
    err(`check-npmjs.sh must fail without an npm login session (got ${noLoginRun.status}: ${noLoginOut})`);
  }
  writeCheckNpmjsNpm(npmjsDir);

  const passRun = run(['keyv', '--repo', 'owner/test', '--workflow', 'release.yaml']);
  const passOut = `${passRun.stdout}${passRun.stderr}`;
  if (passRun.status !== 0) {
    err(`check-npmjs.sh stage-only config must pass (got ${passRun.status}: ${passOut})`);
  } else if (!/stage-only/.test(passOut) || !/skipped: registry has no GET/.test(passOut)) {
    err(`check-npmjs.sh pass output missing stage-only pass or MFA skip (got: ${passOut})`);
  }

  writeCheckNpmjsCurl(npmjsDir, {
    mode: 'publish',
    scriptPath: checkNpmjsPath,
    callLog: join(npmjsDir, 'publish.log'),
  });
  const publishRun = run(['keyv', '--repo', 'owner/test', '--workflow', 'release.yaml']);
  const publishOut = `${publishRun.stdout}${publishRun.stderr}`;
  if (publishRun.status === 0 || !/createPackage/.test(publishOut)) {
    err(`check-npmjs.sh must fail when trusted publisher can npm publish (got: ${publishOut})`);
  }

  writeCheckNpmjsCurl(npmjsDir, {
    mode: 'legacy',
    scriptPath: checkNpmjsPath,
    callLog: join(npmjsDir, 'legacy.log'),
  });
  const legacyRun = run(['keyv', '--repo', 'owner/test', '--workflow', 'release.yaml']);
  const legacyOut = `${legacyRun.stdout}${legacyRun.stderr}`;
  if (legacyRun.status === 0 || !/legacy/.test(legacyOut)) {
    err(`check-npmjs.sh must fail a trusted publisher with no permissions field (got: ${legacyOut})`);
  }

  writeCheckNpmjsCurl(npmjsDir, {
    mode: 'mfa',
    scriptPath: checkNpmjsPath,
    callLog: join(npmjsDir, 'mfa.log'),
  });
  const mfaRun = run(['keyv', '--repo', 'owner/test', '--workflow', 'release.yaml']);
  const mfaOut = `${mfaRun.stdout}${mfaRun.stderr}`;
  if (mfaRun.status !== 0 || !/requires 2FA and disallows tokens/.test(mfaOut)) {
    err(`check-npmjs.sh must pass when publishing access fields are readable (got: ${mfaOut})`);
  }

  writeCheckNpmjsCurl(npmjsDir, {
    mode: 'pass',
    scriptPath: checkNpmjsPath,
    callLog: join(npmjsDir, 'scoped.log'),
  });
  const scopedRun = run(['@scope/pkg', '--repo', 'owner/test', '--workflow', 'release.yaml']);
  const scopedCalls = readFileSync(join(npmjsDir, 'scoped.log'), 'utf8');
  if (scopedRun.status !== 0) {
    err(`check-npmjs.sh scoped package must pass (got: ${scopedRun.stdout}${scopedRun.stderr})`);
  } else if (!scopedCalls.includes('/-/package/@scope%2Fpkg/trust')) {
    err(`check-npmjs.sh must encode scoped names as @scope%2Fpkg (got: ${scopedCalls})`);
  }

  writeCheckNpmjsCurl(npmjsDir, {
    mode: 'stale',
    scriptPath: checkNpmjsPath,
    callLog: join(npmjsDir, 'stale.log'),
  });
  const staleRun = run(['keyv', '--repo', 'owner/test', '--workflow', 'release.yaml']);
  const staleOut = `${staleRun.stdout}${staleRun.stderr}`;
  if (!/not the latest from jaredwray\/agentic/.test(staleOut)) {
    err(`check-npmjs.sh must warn when it differs from upstream (got: ${staleOut})`);
  }

  writeCheckNpmjsCurl(npmjsDir, {
    mode: 'offline',
    scriptPath: checkNpmjsPath,
    callLog: join(npmjsDir, 'offline.log'),
  });
  const offlineRun = run(['keyv', '--repo', 'owner/test', '--workflow', 'release.yaml']);
  const offlineOut = `${offlineRun.stdout}${offlineRun.stderr}`;
  if (!/could not verify this check-npmjs\.sh is the latest/.test(offlineOut)) {
    err(`check-npmjs.sh must warn and continue when upstream is unreachable (got: ${offlineOut})`);
  }
  if (/not the latest from jaredwray\/agentic/.test(offlineOut)) {
    err(`check-npmjs.sh must not claim it is stale when upstream could not be fetched (got: ${offlineOut})`);
  }

  writeFileSync(
    join(npmjsDir, 'package.json'),
    JSON.stringify({ name: 'site', private: true, version: '1.0.0' }),
  );
  writeCheckNpmjsCurl(npmjsDir, {
    mode: 'pass',
    scriptPath: checkNpmjsPath,
    callLog: join(npmjsDir, 'empty.log'),
  });
  const emptyRun = spawnSync('bash', [checkNpmjsPath], {
    encoding: 'utf8',
    cwd: npmjsDir,
    env: { PATH: `${npmjsDir}:${process.env.PATH}`, LANG: 'C', HOME: npmjsDir },
  });
  const emptyOut = `${emptyRun.stdout}${emptyRun.stderr}`;
  if (emptyRun.status !== 0 || !/No publishable packages/.test(emptyOut)) {
    err(`check-npmjs.sh must skip when the checkout has no publishable packages (got: ${emptyOut})`);
  }
} finally {
  rmSync(npmjsDir, { recursive: true, force: true });
}

if (errors.length) {
  console.error(`\n❌ ${errors.length} error(s):`);
  for (const e of errors) console.error(`   - ${e}`);
  process.exit(1);
}

console.log('Safe Chain cloud-bootstrap templates and script checks passed.');
