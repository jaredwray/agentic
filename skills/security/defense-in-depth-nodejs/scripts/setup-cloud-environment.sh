#!/usr/bin/env bash
# setup-cloud-environment.sh — Aikido Safe Chain bootstrap for Codespaces and Cursor Cloud Agents.
#
# Fail closed: never install dependencies unless Safe Chain shims are on PATH.
# Copied into the target repo as scripts/setup-cloud-environment.sh.

set -euo pipefail

export SAFE_CHAIN_VERSION="1.5.15"
SAFE_CHAIN_INSTALLER_SHA256="de0565e3d6346407a604e84e639e95fea8758748063da2216bbfdca5feda5dd2"
SAFE_CHAIN_INSTALLER_URL="https://github.com/AikidoSec/safe-chain/releases/download/${SAFE_CHAIN_VERSION}/install-safe-chain.sh"
SAFE_CHAIN_SHIMS="${HOME}/.safe-chain/shims"
SAFE_CHAIN_BIN="${HOME}/.safe-chain/bin"
COREPACK_SHIMS="${HOME}/.local/bin"
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0

if git_root=$(git rev-parse --show-toplevel 2>/dev/null); then
  cd "$git_root"
fi

if [[ ! -f pnpm-lock.yaml ]]; then
  echo "error: pnpm-lock.yaml is required; refusing to install without a frozen lockfile" >&2
  exit 1
fi

# nvm.sh returns 3 when auto-use fails (unmet .nvmrc). Source at top level with
# errexit off so that status cannot abort postCreateCommand. Do not move this
# into devcontainer.json (`bash -i` / `source ~/.bashrc`) — a fresh Codespace
# never sees those; already-open terminals can `source ~/.bashrc` after setup.
nvm_script=""
for nvm_candidate in "${NVM_DIR:-}" /usr/local/share/nvm "${HOME}/.nvm"; do
  if [[ -n "$nvm_candidate" && -s "${nvm_candidate}/nvm.sh" ]]; then
    nvm_script="${nvm_candidate}/nvm.sh"
    export NVM_DIR="$nvm_candidate"
    break
  fi
done
if [[ -n "$nvm_script" ]]; then
  set +euo pipefail
  # --no-use skips nvm_auto, which is what returns 3.
  # shellcheck disable=SC1091
  . "$nvm_script" --no-use
  if ! command -v node >/dev/null 2>&1 && command -v nvm >/dev/null 2>&1; then
    nvm use default >/dev/null 2>&1
  fi
  set -euo pipefail
fi

enable_corepack() {
  mkdir -p "$COREPACK_SHIMS"
  case ":${PATH}:" in
    *":${COREPACK_SHIMS}:"*) ;;
    *) export PATH="${COREPACK_SHIMS}:${PATH}" ;;
  esac
  if [[ -n "${COREPACK_HOME:-}" && ! -w "${COREPACK_HOME}" ]]; then
    export COREPACK_HOME="${HOME}/.cache/node/corepack"
  fi
  mkdir -p "${COREPACK_HOME:-${HOME}/.cache/node/corepack}"

  # javascript-node owns Node's bin dir as root; unprivileged `corepack enable`
  # hits EACCES writing /usr/local/bin. Put shims in a user-writable directory.
  if corepack enable --install-directory "$COREPACK_SHIMS"; then
    return 0
  fi
  if command -v sudo >/dev/null 2>&1 && sudo -n corepack enable; then
    return 0
  fi
  return 1
}

if [[ -f package.json ]] && grep -q '"packageManager"' package.json && command -v corepack >/dev/null; then
  if ! enable_corepack; then
    echo "warning: corepack enable failed; continuing if pnpm is already on PATH" >&2
  fi
fi

if ! command -v pnpm >/dev/null; then
  echo "error: pnpm is required on PATH before Safe Chain can wrap it" >&2
  exit 1
fi

installer=$(mktemp)
trap 'rm -f "$installer"' EXIT

curl -fsSL "$SAFE_CHAIN_INSTALLER_URL" -o "$installer"
echo "${SAFE_CHAIN_INSTALLER_SHA256}  ${installer}" | sha256sum -c -

sh "$installer" --ci

export PATH="${SAFE_CHAIN_SHIMS}:${SAFE_CHAIN_BIN}:${PATH}"

persist_shim_path() {
  local rc="$1"
  local line="export PATH=\"${SAFE_CHAIN_SHIMS}:${SAFE_CHAIN_BIN}:${COREPACK_SHIMS}:\$PATH\""
  if [[ -f "$rc" ]] && grep -Fq ".safe-chain/shims" "$rc"; then
    return 0
  fi
  mkdir -p "$(dirname "$rc")"
  printf '\n# Aikido Safe Chain shims\n%s\n' "$line" >> "$rc"
}

persist_shim_path "${HOME}/.profile"
persist_shim_path "${HOME}/.bashrc"
persist_shim_path "${HOME}/.zshrc"

if [[ -n "${GITHUB_PATH:-}" ]]; then
  printf '%s\n' "$SAFE_CHAIN_SHIMS" >> "$GITHUB_PATH"
  printf '%s\n' "$SAFE_CHAIN_BIN" >> "$GITHUB_PATH"
  printf '%s\n' "$COREPACK_SHIMS" >> "$GITHUB_PATH"
fi

pnpm safe-chain-verify
pnpm install --frozen-lockfile
