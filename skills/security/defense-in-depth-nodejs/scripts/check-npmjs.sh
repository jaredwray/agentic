#!/usr/bin/env bash
# check-npmjs.sh — audit npmjs.com publishing settings for defense-in-depth-nodejs § 5.
#
# NEVER check this file into a target repo. It lives only in this skill.
# Check-only: it never changes package settings (writes need interactive 2FA).
#
# Audits, per publishable package:
#
#   1. OIDC trusted publisher is GitHub Actions, bound to this repo and the
#      stage-publish workflow, with stage-only permissions (createStagedPackage,
#      never createPackage). Legacy configs with no permissions field are treated
#      as publish-only and fail.
#   2. Publishing access requires 2FA and disallows tokens, when the registry
#      exposes those fields. GET /-/package/{pkg}/access is not allowed on
#      registry.npmjs.org; if the setting cannot be read, the check is skipped
#      with the npmjs.com URL — it is not treated as passing.
#   3. The published packument repository.url maps to this GitHub repo so
#      provenance can bind.
#
# Drydock and human 2FA promotion are not npmjs API settings; they stay (manual).
#
# Requires: curl, node, npm. Auth: npm login session only. NPM_TOKEN is not
# allowed — catalog § 5 forbids long-lived npm tokens.
#
# On start, compares this file to jaredwray/agentic@main and warns if this copy
# is not the latest. The warning does not fail the run.

set -euo pipefail

usage() {
  cat <<'EOF'
Usage: check-npmjs.sh [package...] [--repo owner/repo] [--workflow file.yaml] [--environment name] [--otp code] [--registry url]

  package             npm package name(s). Defaults to publishable packages in this repo.
  --repo              GitHub owner/repo the trusted publisher must bind to.
                      Defaults to the current checkout (gh, origin, or package.json).
  --workflow          Trusted-publisher workflow filename (not a path). Defaults to the
                      repo workflow that runs `stage publish`, or release.yaml.
  --environment       If set, the trusted publisher must use this GitHub environment.
  --otp               npm 2FA OTP if the registry challenges GET /trust.
  --registry          Registry URL. Defaults to https://registry.npmjs.org/.

Requires curl, node, and an npm login session with write access (run npm login).
NPM_TOKEN is not allowed — catalog § 5 forbids long-lived npm tokens.
Check-only — never changes npmjs settings. Never check this file into a target repo.
Warns (does not fail) if this copy is not the latest from jaredwray/agentic.
EOF
}

PACKAGES=()
REPO=""
WORKFLOW=""
ENVIRONMENT=""
ENVIRONMENT_SET=0
OTP="${NPM_OTP:-}"
REGISTRY="${NPM_REGISTRY:-https://registry.npmjs.org/}"

need_val() {
  [[ $# -ge 2 && "$2" != --* ]] || { echo "error: $1 requires a value"; exit 1; }
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo) need_val "$@"; REPO="$2"; shift ;;
    --workflow) need_val "$@"; WORKFLOW="$2"; shift ;;
    --environment) need_val "$@"; ENVIRONMENT="$2"; ENVIRONMENT_SET=1; shift ;;
    --otp) need_val "$@"; OTP="$2"; shift ;;
    --registry) need_val "$@"; REGISTRY="$2"; shift ;;
    -h|--help) usage; exit 0 ;;
    --*)
      echo "error: unknown option $1"
      usage
      exit 1
      ;;
    *) PACKAGES+=("$1") ;;
  esac
  shift
done

looks_like_repo() {
  [[ "$1" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] && [[ "$1" != @* ]]
}

if [[ ${#PACKAGES[@]} -gt 0 ]]; then
  for p in "${PACKAGES[@]}"; do
    if looks_like_repo "$p"; then
      echo "error: \"$p\" looks like owner/repo — pass it as --repo, not as a package name"
      exit 1
    fi
  done
fi

if [[ -n "$WORKFLOW" ]]; then
  if [[ "$WORKFLOW" == *"/"* ]]; then
    echo "error: --workflow must be a filename, not a path: $WORKFLOW"
    exit 1
  fi
  if [[ "$WORKFLOW" == *" "* ]]; then
    echo "error: --workflow must not contain spaces: $WORKFLOW"
    exit 1
  fi
  if [[ "$WORKFLOW" != *.yml && "$WORKFLOW" != *.yaml ]]; then
    echo "error: --workflow must end in .yml or .yaml: $WORKFLOW"
    exit 1
  fi
fi

command -v curl >/dev/null || { echo "error: curl is required"; exit 1; }
command -v node >/dev/null || { echo "error: node is required"; exit 1; }

# Canonical source of this script. A stale plugin cache or copied file can audit
# against outdated rules. Warn and continue — never fail the run on this check.
UPSTREAM_REPO="jaredwray/agentic"
UPSTREAM_PATH="skills/security/defense-in-depth-nodejs/scripts/check-npmjs.sh"

check_upstream_script() {
  local tmp
  tmp=$(mktemp) || {
    echo "warning: could not verify this check-npmjs.sh is the latest from ${UPSTREAM_REPO} — continuing"
    return 0
  }
  if curl -fsSL -H "Accept: application/vnd.github.raw" \
       "https://api.github.com/repos/${UPSTREAM_REPO}/contents/${UPSTREAM_PATH}?ref=main" \
       -o "$tmp" 2>/dev/null && [[ -s "$tmp" ]]; then
    if ! cmp -s "$tmp" "${BASH_SOURCE[0]}"; then
      echo "warning: this check-npmjs.sh is not the latest from ${UPSTREAM_REPO}."
      echo "         Update the agentic skill (plugin update, or git pull) and re-run."
      echo "         https://github.com/${UPSTREAM_REPO}/blob/main/${UPSTREAM_PATH}"
    fi
  else
    echo "warning: could not verify this check-npmjs.sh is the latest from ${UPSTREAM_REPO} — continuing"
  fi
  rm -f "$tmp"
}

check_upstream_script

REGISTRY="${REGISTRY%/}/"
REGISTRY_HOST="${REGISTRY#*://}"
REGISTRY_HOST="${REGISTRY_HOST%%/*}"

node_json() {
  # Read JSON on stdin; evaluate QUERY (a JS expression using `d`) to stdout.
  QUERY="$1" node --input-type=commonjs -e '
    const fs = require("fs");
    const raw = fs.readFileSync(0, "utf8");
    let d;
    try { d = JSON.parse(raw); } catch (e) {
      process.stderr.write("error: registry JSON did not parse: " + e.message + "\n");
      process.exit(2);
    }
    let v;
    try { v = eval(process.env.QUERY); } catch (e) {
      process.stderr.write("error: JSON query failed: " + e.message + "\n");
      process.exit(2);
    }
    if (v === undefined || v === null) process.stdout.write("");
    else if (typeof v === "object") process.stdout.write(JSON.stringify(v));
    else process.stdout.write(String(v));
  '
}

github_repo_from_url() {
  local u="$1"
  [[ -z "$u" ]] && return 1
  u="${u#git+}"
  u="${u#ssh://}"
  u="${u#git://}"
  u="${u%.git}"
  u="${u%/}"
  if [[ "$u" =~ github\.com[:/]+([^/]+)/([^/]+) ]]; then
    printf '%s/%s\n' "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}"
    return 0
  fi
  if [[ "$u" =~ ^github:([^/]+)/([^/]+) ]]; then
    printf '%s/%s\n' "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}"
    return 0
  fi
  return 1
}

escape_pkg() {
  # npm-package-arg escapedName: encode `/` only, leave `@` as-is.
  printf '%s' "${1//\//%2F}"
}

discover_packages() {
  node --input-type=commonjs -e '
    const fs = require("fs");
    const path = require("path");
    const skip = new Set(["node_modules", ".git", "dist", "coverage", ".next", "packed", ".changeset"]);
    const names = new Set();
    function walk(dir, depth) {
      if (depth > 6) return;
      let entries;
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        if (e.name.startsWith(".") && e.name !== ".github") continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (skip.has(e.name)) continue;
          walk(p, depth + 1);
        } else if (e.name === "package.json") {
          let pkg;
          try { pkg = JSON.parse(fs.readFileSync(p, "utf8")); } catch { continue; }
          if (pkg && pkg.name && pkg.private !== true) names.add(pkg.name);
        }
      }
    }
    walk(process.cwd(), 0);
    process.stdout.write([...names].sort().join("\n"));
  '
}

discover_stage_workflow() {
  local dir=".github/workflows"
  [[ -d "$dir" ]] || return 1
  local hits=() f
  for f in "$dir"/*.yml "$dir"/*.yaml; do
    [[ -f "$f" ]] || continue
    if grep -q 'stage publish' "$f"; then
      hits+=("$(basename "$f")")
    fi
  done
  if [[ ${#hits[@]} -eq 1 ]]; then
    printf '%s\n' "${hits[0]}"
    return 0
  fi
  return 1
}

resolve_repo() {
  local url
  if [[ -n "$REPO" ]]; then
    return 0
  fi
  if command -v gh >/dev/null; then
    REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner 2>/dev/null || true)
    [[ -n "$REPO" ]] && return 0
  fi
  if command -v git >/dev/null; then
    url=$(git remote get-url origin 2>/dev/null || true)
    if REPO=$(github_repo_from_url "$url"); then
      return 0
    fi
  fi
  if [[ -f package.json ]]; then
    url=$(node --input-type=commonjs -e '
      const p = JSON.parse(require("fs").readFileSync("package.json", "utf8"));
      const r = p.repository;
      process.stdout.write(typeof r === "string" ? r : (r && r.url) || "");
    ' 2>/dev/null || true)
    if REPO=$(github_repo_from_url "$url"); then
      return 0
    fi
  fi
  echo "error: could not determine GitHub owner/repo — pass --repo owner/repo"
  exit 1
}

resolve_token() {
  local key val
  if [[ -n "${NPM_TOKEN:-}" ]]; then
    echo "error: NPM_TOKEN is not allowed — unset it and run npm login"
    echo "       catalog § 5: no npm tokens exist anywhere; this audit uses an npm login session only."
    exit 1
  fi
  if ! command -v npm >/dev/null; then
    echo "error: npm is required — run npm login"
    exit 1
  fi
  key="//${REGISTRY_HOST}/:_authToken"
  val=$(npm config get "$key" 2>/dev/null || true)
  if [[ -n "$val" && "$val" != "undefined" && "$val" != "null" ]]; then
    TOKEN="$val"
    return 0
  fi
  echo "error: no npm login session — run npm login"
  echo "       GET /-/package/{pkg}/trust needs write access from an interactive login."
  exit 1
}

WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT
TOKEN=""
HTTP_BODY="$WORKDIR/body"
FAILS=0
pass() { echo "  ✓ $1"; }
fail() { echo "  ✗ $1"; FAILS=$((FAILS + 1)); }
skip() { echo "  - $1 (skipped: $2)"; }
step() { echo "[$1] $2"; }

registry_get() {
  # $1=path starting with /  → sets HTTP_CODE and HTTP_BODY
  local path="$1"
  local args=(-sS -o "$HTTP_BODY" -w '%{http_code}' -H "Accept: application/json")
  [[ -n "$TOKEN" ]] && args+=(-H "Authorization: Bearer $TOKEN")
  [[ -n "$OTP" ]] && args+=(-H "npm-otp: $OTP")
  HTTP_CODE=$(curl "${args[@]}" "${REGISTRY%/}$path") || HTTP_CODE="000"
}

auth_hint() {
  local body
  body=$(cat "$HTTP_BODY" 2>/dev/null || true)
  if grep -qiE 'otp|one-time|2fa|webauthn' <<<"$body"; then
    echo "pass --otp <code> (or NPM_OTP) after completing the 2FA challenge"
  else
    echo "log in with npm login (NPM_TOKEN is not allowed)"
  fi
}

if [[ ${#PACKAGES[@]} -eq 0 ]]; then
  mapfile -t PACKAGES < <(discover_packages)
  if [[ ${#PACKAGES[@]} -eq 0 || -z "${PACKAGES[0]:-}" ]]; then
    echo "No publishable packages in this checkout (website/app, or all private)."
    echo "Pass package names explicitly to audit registry settings anyway."
    exit 0
  fi
fi

if [[ -z "$WORKFLOW" ]]; then
  WORKFLOW=$(discover_stage_workflow || true)
  [[ -n "$WORKFLOW" ]] || WORKFLOW="release.yaml"
fi

resolve_repo
resolve_token

echo "Registry: $REGISTRY"
echo "GitHub repo: $REPO"
echo "Workflow: $WORKFLOW"
if [[ "$ENVIRONMENT_SET" -eq 1 ]]; then
  echo "Environment: ${ENVIRONMENT:-<(none)>}"
fi
echo "Packages: ${PACKAGES[*]}"
echo

audit_trust() {
  local pkg="$1" escaped path count type repository file env perms
  escaped=$(escape_pkg "$pkg")
  path="/-/package/${escaped}/trust"
  registry_get "$path"
  if [[ "$HTTP_CODE" != "200" ]]; then
    fail "trusted publisher: HTTP $HTTP_CODE ($(auth_hint))"
    return
  fi
  count=$(node_json 'Array.isArray(d) ? d.length : (d && typeof d === "object" ? 1 : 0)' <"$HTTP_BODY")
  if [[ "$count" != "1" ]]; then
    fail "want exactly one trusted publisher, have ${count:-0}"
    return
  fi
  type=$(node_json '(Array.isArray(d) ? d[0] : d).type || ""' <"$HTTP_BODY")
  repository=$(node_json '(Array.isArray(d) ? d[0] : d).claims && (Array.isArray(d) ? d[0] : d).claims.repository || ""' <"$HTTP_BODY")
  file=$(node_json '
    const c = Array.isArray(d) ? d[0] : d;
    const wr = c.claims && c.claims.workflow_ref;
    if (typeof wr === "string") wr;
    else if (wr && typeof wr === "object") wr.file || "";
    else "";
  ' <"$HTTP_BODY")
  env=$(node_json '
    const c = Array.isArray(d) ? d[0] : d;
    const e = (c.claims && c.claims.environment) || c.environment || "";
    e;
  ' <"$HTTP_BODY")
  perms=$(node_json '
    const c = Array.isArray(d) ? d[0] : d;
    const p = c.permissions;
    Array.isArray(p) ? p.slice().sort().join(",") : "";
  ' <"$HTTP_BODY")

  if [[ "$type" != "github" ]]; then
    fail "trusted publisher type want github, have ${type:-unset}"
  else
    pass "trusted publisher type is github"
  fi

  if [[ "$repository" != "$REPO" ]]; then
    fail "trusted publisher repository want $REPO, have ${repository:-unset}"
  else
    pass "trusted publisher repository is $REPO"
  fi

  if [[ "$file" != "$WORKFLOW" ]]; then
    fail "trusted publisher workflow want $WORKFLOW, have ${file:-unset}"
  else
    pass "trusted publisher workflow is $WORKFLOW"
  fi

  if [[ "$ENVIRONMENT_SET" -eq 1 ]]; then
    if [[ "$env" != "$ENVIRONMENT" ]]; then
      fail "trusted publisher environment want ${ENVIRONMENT:-<(none)>}, have ${env:-unset}"
    else
      pass "trusted publisher environment is ${ENVIRONMENT:-<(none)>}"
    fi
  elif [[ -n "$env" ]]; then
    pass "trusted publisher environment is $env (not constrained)"
  fi

  # Missing permissions = legacy config, treated as npm publish only.
  if [[ "$perms" == "createStagedPackage" ]]; then
    pass "trusted publisher is stage-only (createStagedPackage, not createPackage)"
  elif [[ -z "$perms" ]]; then
    fail "trusted publisher has no permissions field — legacy configs allow npm publish, not stage-only"
  else
    fail "trusted publisher permissions want only createStagedPackage, have ${perms}"
  fi
}

audit_publishing_access() {
  local pkg="$1" escaped vis_tfa vis_auto acc_tfa acc_auto tfa auto
  escaped=$(escape_pkg "$pkg")

  registry_get "/-/package/${escaped}/access"
  acc_tfa=""
  acc_auto=""
  if [[ "$HTTP_CODE" == "200" ]]; then
    acc_tfa=$(node_json 'd.publish_requires_tfa === true ? "true" : (d.publish_requires_tfa === false ? "false" : "")' <"$HTTP_BODY")
    acc_auto=$(node_json 'd.automation_token_overrides_tfa === true ? "true" : (d.automation_token_overrides_tfa === false ? "false" : "")' <"$HTTP_BODY")
  fi

  registry_get "/-/package/${escaped}/visibility"
  vis_tfa=""
  vis_auto=""
  if [[ "$HTTP_CODE" == "200" ]]; then
    vis_tfa=$(node_json 'd.publish_requires_tfa === true ? "true" : (d.publish_requires_tfa === false ? "false" : "")' <"$HTTP_BODY")
    vis_auto=$(node_json 'd.automation_token_overrides_tfa === true ? "true" : (d.automation_token_overrides_tfa === false ? "false" : "")' <"$HTTP_BODY")
  fi

  tfa="${acc_tfa:-$vis_tfa}"
  auto="${acc_auto:-$vis_auto}"

  if [[ -z "$tfa" || -z "$auto" ]]; then
    skip "2FA and disallow tokens" \
      "registry has no GET for publishing access — confirm at https://www.npmjs.com/package/${pkg}/access that \"Require two-factor authentication and disallow tokens\" is selected"
    return
  fi
  if [[ "$tfa" == "true" && "$auto" == "false" ]]; then
    pass "publishing access requires 2FA and disallows tokens"
  else
    fail "publishing access want publish_requires_tfa=true and automation_token_overrides_tfa=false, have ${tfa}/${auto}"
  fi
}

# Public packument GET should not depend on write-token quirks: fetch without
# Authorization by temporarily clearing TOKEN.
audit_repository_url() {
  local pkg="$1" escaped url mapped saved code
  escaped=$(escape_pkg "$pkg")
  saved="$TOKEN"
  TOKEN=""
  registry_get "/${escaped}"
  code="$HTTP_CODE"
  TOKEN="$saved"
  if [[ "$code" != "200" ]]; then
    fail "packument HTTP $code — cannot confirm repository.url"
    return
  fi
  url=$(node_json 'typeof d.repository === "string" ? d.repository : ((d.repository && d.repository.url) || "")' <"$HTTP_BODY")
  if ! mapped=$(github_repo_from_url "$url"); then
    fail "packument repository.url want GitHub $REPO, have ${url:-unset}"
    return
  fi
  if [[ "$mapped" != "$REPO" ]]; then
    fail "packument repository.url want $REPO, have $mapped"
  else
    pass "packument repository.url maps to $REPO"
  fi
}

i=0
for pkg in "${PACKAGES[@]}"; do
  i=$((i + 1))
  echo "Package: $pkg"
  step "$i.1" "OIDC trusted publisher (stage-only)"
  audit_trust "$pkg"
  step "$i.2" "Publishing access (2FA, disallow tokens)"
  audit_publishing_access "$pkg"
  step "$i.3" "Packument repository.url"
  audit_repository_url "$pkg"
  echo
done

if [[ "$FAILS" -gt 0 ]]; then
  echo "Audit: $FAILS setting(s) not in the desired state."
  echo "Configure on npmjs.com (interactive 2FA), then re-run. This script never applies settings."
  exit 1
fi
echo "Audit: all readable npmjs settings are in the desired state."
echo "Remaining catalog items that this script cannot see: Drydock connection, human 2FA promotion."
