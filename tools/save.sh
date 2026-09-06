#!/usr/bin/env bash
# save.sh — commit and push in-progress work so it survives the session.
#
# The cloud environment behind a Claude session can be deleted at any moment.
# Anything that only ever lived inside that container goes with it; anything
# pushed to GitHub does not. This script is the bridge between the two.
#
#   tools/save.sh              commit + push, message generated from the diff
#   tools/save.sh "message"    commit + push with your own message
#   tools/save.sh --auto       silent, no-op on a clean tree (what the Stop hook runs)
#
# It never exits non-zero: a failure here must not take down the turn that
# called it. Worst case it says what went wrong and leaves the commit local.

set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
cd "$ROOT" || exit 0

AUTO=0
if [ "${1:-}" = "--auto" ]; then AUTO=1; shift; fi
MSG="${1:-}"

LOG="SESSION-LOG.md"
MARKER="<!-- log -->"
SITE="https://rashyl6.github.io/books"

say() { [ "$AUTO" -eq 1 ] || printf '%s\n' "$*"; }

# --- what changed -----------------------------------------------------------
# The log file is excluded: this script is about to write to it, and an entry
# recording only "the log changed" is noise.
CHANGED=()
while IFS= read -r line; do
    p="${line:3}"       # porcelain v1: two status chars + a space
    p="${p##* -> }"     # renames arrive as "old -> new"; keep the new name
    CHANGED+=("$p")
done < <(git status --porcelain -uall -- . ":(exclude)$LOG")

if [ "${#CHANGED[@]}" -eq 0 ]; then
    say "Nothing to save — working tree is clean."
    exit 0
fi

# --- message ----------------------------------------------------------------
if [ -z "$MSG" ]; then
    n=${#CHANGED[@]}
    list=""
    for f in "${CHANGED[@]:0:3}"; do list="${list:+$list, }$f"; done
    [ "$n" -gt 3 ] && list="$list (+$((n - 3)) more)"
    MSG="wip: $list"
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
STAMP="$(date -u '+%Y-%m-%d %H:%M UTC')"

# --- log entry (newest first, just under the marker) ------------------------
if [ ! -f "$LOG" ]; then
    cat > "$LOG" <<HEADER
# Session log

Every entry below was written by \`tools/save.sh\` at the moment the work was
pushed. Newest first.

$MARKER
HEADER
fi

ENTRY="$(mktemp)"
{
    printf '\n### %s · %s\n\n' "$STAMP" "$BRANCH"
    printf '%s\n\n' "$MSG"
    for f in "${CHANGED[@]:0:25}"; do printf -- '- `%s`\n' "$f"; done
    [ "${#CHANGED[@]}" -gt 25 ] && printf -- '- `… and %s more`\n' "$((${#CHANGED[@]} - 25))"
} > "$ENTRY"

NEWLOG="$(mktemp)"
if sed "/$MARKER/r $ENTRY" "$LOG" > "$NEWLOG"; then
    mv "$NEWLOG" "$LOG"
else
    rm -f "$NEWLOG"
fi
rm -f "$ENTRY"

# --- commit -----------------------------------------------------------------
git add -A
if git diff --cached --quiet; then
    say "Nothing to save — working tree is clean."
    exit 0
fi

if ! git commit -q -m "$MSG" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"; then
    printf 'save: commit failed, work is still in the working tree\n' >&2
    exit 0
fi

SHA="$(git rev-parse --short HEAD)"
say "Committed $SHA — $MSG"

# --- push -------------------------------------------------------------------
# A cloud environment may hand us a read-only SSH deploy key while the gh CLI
# holds a token that can write, so an SSH failure is retried over HTTPS before
# we call it a day.
PUSH_ERR="$(mktemp)"
ORIGIN_URL="$(git remote get-url origin 2>/dev/null || echo '')"
HTTPS_URL="$(printf '%s' "$ORIGIN_URL" | sed -e 's#^git@github\.com:#https://github.com/#' -e 's#^ssh://git@github\.com/#https://github.com/#')"

push_to() { timeout 60 git push -q "$1" "HEAD:$BRANCH" 2>"$PUSH_ERR"; }

if push_to origin; then
    say "Pushed to origin/$BRANCH → $SITE/status.html"
elif [ -n "$HTTPS_URL" ] && [ "$HTTPS_URL" != "$ORIGIN_URL" ] && push_to "$HTTPS_URL"; then
    say "Pushed to $BRANCH over HTTPS → $SITE/status.html"
    say "  (the SSH remote was refused; run 'git remote set-url origin $HTTPS_URL' to skip that step next time)"
else
    printf 'save: commit %s is safe locally, but the push failed:\n' "$SHA" >&2
    sed 's/^/  /' "$PUSH_ERR" >&2
    printf '  Re-run "tools/save.sh" once the network or credentials are back.\n' >&2
fi
rm -f "$PUSH_ERR"
exit 0
