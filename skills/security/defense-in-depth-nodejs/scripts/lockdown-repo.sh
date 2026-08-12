#!/usr/bin/env bash
# lockdown-repo.sh — one-shot GitHub repo lockdown for the defense-in-depth-nodejs skill.
#
# Applies the "Repository lockdown" settings (DEFENSE_IN_DEPTH.md § 2) to a repo:
#
#   1. Default workflow token permissions: read-only; Actions cannot create/approve PRs
#   2. Workflow runs from ALL outside collaborators require owner approval
#   3. Branch ruleset on the default branch: pull request required, force pushes and
#      deletion blocked (no bypass — admins go through PRs too)
#   4. Tag ruleset "Tags only by admins": only repository admins can create tags
#   5. Secret scanning + push protection (plan-gated on private repos)
#   6. Private vulnerability reporting (public repos only)
#   7. Dependabot vulnerability alerts
#
# Usage:
#   lockdown-repo.sh [owner/repo] [--check]
#
#   owner/repo   Target repository. Defaults to the repo of the current directory.
#   --check      Audit only: report PASS/FAIL per setting, change nothing.
#                Exits 1 if any applicable setting is not in the desired state.
#
# Requires: gh (https://cli.github.com) authenticated as a repository admin.
# Everything it does is idempotent — safe to re-run any time.

set -euo pipefail

REPO=""
CHECK=0
for arg in "$@"; do
  case "$arg" in
    --check) CHECK=1 ;;
    -h|--help) sed -n '2,24p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) REPO="$arg" ;;
  esac
done

command -v gh >/dev/null || { echo "error: gh CLI is required (https://cli.github.com)"; exit 1; }

if [[ -z "$REPO" ]]; then
  REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner 2>/dev/null) ||
    { echo "error: not inside a repo checkout — pass owner/repo explicitly"; exit 1; }
fi

echo "Repository: $REPO"

gh api "repos/$REPO" --jq .full_name >/dev/null 2>&1 ||
  { echo "error: cannot read repos/$REPO — check the name and your gh auth"; exit 1; }
PRIVATE=$(gh api "repos/$REPO" --jq .private)
DEFAULT_BRANCH=$(gh api "repos/$REPO" --jq .default_branch)
IS_ADMIN=$(gh api "repos/$REPO" --jq '.permissions.admin // false' 2>/dev/null || echo false)

echo "Default branch: $DEFAULT_BRANCH · Private: $PRIVATE · You are admin: $IS_ADMIN"
if [[ "$IS_ADMIN" != "true" && "$CHECK" -eq 0 ]]; then
  echo "error: applying settings requires admin permission on $REPO (use --check to audit)"
  exit 1
fi
echo

FAILS=0
pass() { echo "  ✓ $1"; }
fail() { echo "  ✗ $1"; FAILS=$((FAILS + 1)); }
skip() { echo "  - $1 (skipped: $2)"; }

# ---------------------------------------------------------------------------
step() { echo "[$1] $2"; }

# 1. Workflow token permissions -------------------------------------------------
step 1 "Default workflow token permissions"
WF_PERM=$(gh api "repos/$REPO/actions/permissions/workflow" --jq .default_workflow_permissions 2>/dev/null || echo "")
WF_APPROVE=$(gh api "repos/$REPO/actions/permissions/workflow" --jq .can_approve_pull_request_reviews 2>/dev/null || echo "")
if [[ "$WF_PERM" == "read" && "$WF_APPROVE" == "false" ]]; then
  pass "token is read-only and Actions cannot create/approve PRs"
elif [[ "$CHECK" -eq 1 ]]; then
  fail "want default_workflow_permissions=read + can_approve_pull_request_reviews=false, have ${WF_PERM:-?}/${WF_APPROVE:-?}"
else
  gh api -X PUT "repos/$REPO/actions/permissions/workflow" \
    -f default_workflow_permissions=read -F can_approve_pull_request_reviews=false >/dev/null
  pass "set token read-only; Actions can no longer create/approve PRs"
fi

# 2. Approval required for all outside collaborators ---------------------------
step 2 "Workflow run approval for fork PRs"
AP=$(gh api "repos/$REPO/actions/permissions/fork-pr-contributor-approval" --jq .approval_policy 2>/dev/null || echo "")
if [[ "$AP" == "all_external_contributors" ]]; then
  pass "all outside collaborators require approval to run workflows"
elif [[ "$CHECK" -eq 1 ]]; then
  fail "want approval_policy=all_external_contributors, have ${AP:-unset}"
else
  if gh api -X PUT "repos/$REPO/actions/permissions/fork-pr-contributor-approval" \
       -f approval_policy=all_external_contributors >/dev/null 2>&1; then
    pass "owner approval now required for every outside collaborator's workflow run"
  else
    fail "could not set fork-PR approval policy (endpoint may be unavailable on this plan)"
  fi
fi

# 3+4. Rulesets ------------------------------------------------------------------
# A ruleset is judged by its contents, never by its name alone — a pre-existing
# weak ruleset with the right name must not pass the audit. Check mode fetches the
# ruleset and validates enforcement, rule types, targets, and bypass list; apply
# mode always writes the canonical config (create or overwrite), which also heals
# a weak same-name ruleset.

ruleset_id() { # $1=name → repo-level ruleset id, or empty
  gh api "repos/$REPO/rulesets?includes_parents=false" --paginate \
    --jq ".[] | select(.name == \"$1\") | .id" 2>/dev/null | head -1
}

ruleset_compliant() { # $1=id $2=jq filter that prints "ok" for a compliant ruleset
  [[ -n "$1" ]] && [[ "$(gh api "repos/$REPO/rulesets/$1" --jq "$2" 2>/dev/null)" == "ok" ]]
}

# Ruleset helper: create or update a repo ruleset by name from JSON on stdin.
upsert_ruleset() { # $1=name
  local id
  id=$(ruleset_id "$1")
  if [[ -n "$id" ]]; then
    gh api -X PUT "repos/$REPO/rulesets/$id" --input - >/dev/null
    pass "wrote ruleset \"$1\" (id $id, existing config replaced)"
  else
    gh api -X POST "repos/$REPO/rulesets" --input - >/dev/null
    pass "created ruleset \"$1\""
  fi
}

BR_COMPLIANT='if .enforcement == "active"
  and ([.rules[].type] | index("pull_request") and index("deletion") and index("non_fast_forward"))
  and (.conditions.ref_name.include | index("~DEFAULT_BRANCH"))
  and ((.bypass_actors // []) | length == 0)
  then "ok" else "weak" end'

TAG_COMPLIANT='if .enforcement == "active"
  and ([.rules[].type] | index("creation"))
  and (.conditions.ref_name.include | index("~ALL"))
  then "ok" else "weak" end'

step 3 "Branch ruleset: pull requests required on $DEFAULT_BRANCH"
BR_NAME="Pull requests required"
if [[ "$CHECK" -eq 1 ]]; then
  BR_ID=$(ruleset_id "$BR_NAME")
  if ruleset_compliant "$BR_ID" "$BR_COMPLIANT"; then
    pass "ruleset \"$BR_NAME\" is active with PR/deletion/force-push rules on the default branch and no bypass"
  elif [[ -n "$BR_ID" ]]; then
    fail "ruleset \"$BR_NAME\" exists but is weaker than required (rules, target, enforcement, or bypass list)"
  else
    fail "no ruleset \"$BR_NAME\""
  fi
else
  if upsert_ruleset "$BR_NAME" <<'JSON'
{
  "name": "Pull requests required",
  "target": "branch",
  "enforcement": "active",
  "bypass_actors": [],
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "rules": [
    { "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false,
        "allowed_merge_methods": ["merge", "squash", "rebase"]
      } },
    { "type": "deletion" },
    { "type": "non_fast_forward" }
  ]
}
JSON
  then :; else
    fail "could not create branch ruleset (private repos need GitHub Pro/Team for rulesets)"
  fi
fi

step 4 "Tag ruleset: tags only by admins"
TAG_NAME="Tags only by admins"
if [[ "$CHECK" -eq 1 ]]; then
  TAG_ID=$(ruleset_id "$TAG_NAME")
  if ruleset_compliant "$TAG_ID" "$TAG_COMPLIANT"; then
    pass "ruleset \"$TAG_NAME\" is active with creation restricted on all tags"
  elif [[ -n "$TAG_ID" ]]; then
    fail "ruleset \"$TAG_NAME\" exists but is weaker than required (rules, target, or enforcement)"
  else
    fail "no ruleset \"$TAG_NAME\""
  fi
else
  # bypass actor 5 = the "Repository admin" role
  if upsert_ruleset "$TAG_NAME" <<'JSON'
{
  "name": "Tags only by admins",
  "target": "tag",
  "enforcement": "active",
  "bypass_actors": [
    { "actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "always" }
  ],
  "conditions": { "ref_name": { "include": ["~ALL"], "exclude": [] } },
  "rules": [ { "type": "creation" } ]
}
JSON
  then :; else
    fail "could not create tag ruleset (private repos need GitHub Pro/Team for rulesets)"
  fi
fi

# 5. Secret scanning + push protection ------------------------------------------
step 5 "Secret scanning + push protection"
SS=$(gh api "repos/$REPO" --jq '.security_and_analysis.secret_scanning.status' 2>/dev/null || echo "")
SSPP=$(gh api "repos/$REPO" --jq '.security_and_analysis.secret_scanning_push_protection.status' 2>/dev/null || echo "")
if [[ "$SS" == "enabled" && "$SSPP" == "enabled" ]]; then
  pass "secret scanning and push protection enabled"
elif [[ "$CHECK" -eq 1 ]]; then
  if [[ "$PRIVATE" == "true" ]]; then
    skip "secret scanning is ${SS:-off}, push protection is ${SSPP:-off}" "private repo — needs GitHub Secret Protection"
  else
    fail "secret scanning is ${SS:-off}, push protection is ${SSPP:-off}"
  fi
else
  if gh api -X PATCH "repos/$REPO" --input - >/dev/null 2>&1 <<'JSON'
{ "security_and_analysis": {
    "secret_scanning": { "status": "enabled" },
    "secret_scanning_push_protection": { "status": "enabled" } } }
JSON
  then
    pass "enabled secret scanning and push protection"
  elif [[ "$PRIVATE" == "true" ]]; then
    skip "secret scanning" "private repo — requires the GitHub Secret Protection add-on"
  else
    fail "could not enable secret scanning"
  fi
fi

# 6. Private vulnerability reporting (public repos only) -------------------------
step 6 "Private vulnerability reporting"
if [[ "$PRIVATE" == "true" ]]; then
  skip "private vulnerability reporting" "public repos only — use the SECURITY.md email contact"
else
  PVR=$(gh api "repos/$REPO/private-vulnerability-reporting" --jq .enabled 2>/dev/null || echo "")
  if [[ "$PVR" == "true" ]]; then
    pass "private vulnerability reporting enabled"
  elif [[ "$CHECK" -eq 1 ]]; then
    fail "private vulnerability reporting disabled"
  else
    gh api -X PUT "repos/$REPO/private-vulnerability-reporting" >/dev/null
    pass "enabled private vulnerability reporting"
  fi
fi

# 7. Dependabot alerts ------------------------------------------------------------
step 7 "Dependabot vulnerability alerts"
if gh api "repos/$REPO/vulnerability-alerts" >/dev/null 2>&1; then
  pass "Dependabot alerts enabled"
elif [[ "$CHECK" -eq 1 ]]; then
  fail "Dependabot alerts disabled"
else
  gh api -X PUT "repos/$REPO/vulnerability-alerts" >/dev/null
  pass "enabled Dependabot alerts"
fi

# ---------------------------------------------------------------------------------
echo
if [[ "$CHECK" -eq 1 ]]; then
  if [[ "$FAILS" -gt 0 ]]; then
    echo "Audit: $FAILS setting(s) not in the desired state."
    exit 1
  fi
  echo "Audit: all applicable settings are in the desired state."
else
  echo "Done. Settings GitHub cannot script — configure these on npmjs.com (npm libraries only):"
  echo "  · Trusted publishing (OIDC) for the publish workflow — no npm tokens anywhere"
  echo "  · Staged publishing: CI runs 'npm stage publish'; a maintainer promotes with 2FA"
  echo "  · Package access: require 2FA and disallow tokens (no direct publish rights)"
  echo "  · Connect Drydock (https://drydock.org) to review staged releases before promotion"
  [[ "$FAILS" -gt 0 ]] && { echo; echo "warning: $FAILS setting(s) could not be applied — see above."; exit 1; }
fi
