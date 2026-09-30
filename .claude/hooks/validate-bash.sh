#!/usr/bin/env bash
# PreToolUse hook for Bash. Blocks destructive commands and forces a confirmation
# prompt for anything that changes external state (integration branch, deploys,
# hosted Supabase). Exit 2 = block (stderr goes back to Claude). JSON "ask" = prompt the user.
# Protected branches: feature/milestone-1-foundation (integration/default) and main/master.

input="$(cat)"
cmd="$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null)"
[ -z "$cmd" ] && exit 0

PROTECTED='(main|master|feature/milestone-1-foundation)'

block() { echo "Blocked by .claude/hooks/validate-bash.sh: $1" >&2; exit 2; }
ask() {
  jq -n --arg r "$1" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"ask",permissionDecisionReason:$r}}'
  exit 0
}

# Hard blocks
echo "$cmd" | grep -Eq 'rm -rf (/|~|\$HOME|\.)( |$)'                        && block "recursive delete of a root/home/project directory"
echo "$cmd" | grep -Eq 'git push.*(--force|-f( |$)|--force-with-lease)'   && echo "$cmd" | grep -Eq "$PROTECTED" && block "force push to a protected branch"
echo "$cmd" | grep -Eq "git reset --hard origin/$PROTECTED"                && block "hard reset onto a protected branch, discard risk"
echo "$cmd" | grep -Eq '(cat|less|head|tail|echo|type).*\.env($|\.| )' && ! echo "$cmd" | grep -Eq '\.env(\.test)?\.example' && block "printing .env secrets"
echo "$cmd" | grep -Eq 'git add .*\.env($|\.| )' && ! echo "$cmd" | grep -Eq '\.env(\.test)?\.example' && block "staging a .env file"

# Approval gate: external state changes
echo "$cmd" | grep -Eq "git push.*[ :]$PROTECTED( |$)"       && ask "Push to a protected branch needs Emanuel's approval"
echo "$cmd" | grep -Eq 'git merge'                                        && ask "Merge needs Emanuel's approval"
echo "$cmd" | grep -Eq 'gh pr (merge|create)'                             && ask "Opening or merging a PR needs Emanuel's approval"
echo "$cmd" | grep -Eq '(^|[;&| ])(npx )?vercel( |$)'                     && ask "Deploys are on DEPLOY HOLD; needs Emanuel's approval"
echo "$cmd" | grep -Eq 'supabase (link|db push|migration (up|repair)|functions deploy|projects|secrets)' && ask "Hosted Supabase stays inactive; needs Emanuel's approval"
echo "$cmd" | grep -Eq -- '--linked|--db-url'                             && ask "Command targets a remote database; needs Emanuel's approval"
echo "$cmd" | grep -Eq 'disable-mission-ai-drafts'                        && ask "Script disables the HITL gate; confirm target is a local disposable DB"
echo "$cmd" | grep -Eq 'npm publish'                                      && ask "Publishing a package needs Emanuel's approval"

exit 0
