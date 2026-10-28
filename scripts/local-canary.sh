#!/bin/zsh
# Daily full check on this Mac, run by launchd (install with scripts/install-local-canary.sh).
#
# GitHub's runners get a "confirm you're not a bot" wall on YouTube video pages, so the cloud canary
# skips the pause-screen, sidebar and autoplay checks. This runs the whole e2e suite from a home
# connection, in its own clone of main (never your working copy). On failure it opens or updates a
# "canary-local" issue and shows a notification; on success it closes that issue.
#
# INTENT_CANARY_DRY_RUN=1 prints the issue and notification instead of sending them.

REPO=aaronckim/intent-for-youtube
BASE="$HOME/Library/Application Support/intent-canary"
CLONE="$BASE/repo"
LOGS="$HOME/Library/Logs/intent-canary"

notify() {
  if [[ -n "$INTENT_CANARY_DRY_RUN" ]]; then
    print -r -- "[dry run] notification: $1"
  else
    osascript -e "display notification \"$1\" with title \"Intent canary\""
  fi
}

gh_run() {
  if [[ -n "$INTENT_CANARY_DRY_RUN" ]]; then
    print -r -- "[dry run] gh $*"
  else
    gh "$@" --repo "$REPO"
  fi
}

report_failure() {
  local summary=$1
  local body="The daily full check on the Mac failed on $(date +%F).

\`\`\`
$summary
\`\`\`

Screenshots are on the Mac in ~/Library/Application Support/intent-canary/repo/test-results/."
  local issue
  issue=$(gh issue list --repo "$REPO" --label canary-local --state open --json number --jq '.[0].number')
  if [[ -n "$issue" ]]; then
    gh_run issue comment "$issue" --body "$body"
  else
    gh_run issue create --label canary-local --title "Local canary: full YouTube check failing on the Mac" --body "$body"
  fi
  notify "The daily YouTube check failed. Details are in the canary-local issue on GitHub."
}

close_issues() {
  local issue
  for issue in $(gh issue list --repo "$REPO" --label canary-local --state open --json number --jq '.[].number'); do
    gh_run issue close "$issue" --comment "Passing again on the Mac ($(date +%F))."
  done
}

# Everything runs inside main() so zsh has parsed the whole file before `git pull` can rewrite it.
main() {
  if ! curl -sf -o /dev/null --max-time 15 https://www.youtube.com; then
    print "YouTube is unreachable (offline?); skipping today's check."
    return 0
  fi
  if [[ ! -d "$CLONE/.git" ]]; then
    git clone -q "https://github.com/$REPO.git" "$CLONE" || { notify "Couldn't clone the repo."; return 1; }
  fi
  cd "$CLONE" || return 1
  if ! { git checkout -q main && git pull -q --ff-only; }; then
    notify "Couldn't update its copy of main."
    return 1
  fi
  if ! { npm ci --silent && npx playwright install chromium > /dev/null; }; then
    notify "Couldn't install test dependencies."
    return 1
  fi

  local output code summary
  output=$( { npm test --silent && npm run e2e --silent; } 2>&1 )
  code=$?
  print -r -- "$output"
  summary=$(print -r -- "$output" | grep -E '^(✔|✖|- )|^ℹ (pass|fail)|checks passed' | sed -E 's/ Screenshots: .*//')

  if (( code != 0 )); then
    report_failure "$summary"
  elif print -r -- "$output" | grep -qF '(skipped: '; then
    notify "YouTube showed this Mac a bot check too, so the video-page checks were skipped."
  else
    close_issues
  fi
  return $code
}

mkdir -p "$BASE" "$LOGS"
exec >> "$LOGS/$(date +%F).log" 2>&1
print "== $(date '+%F %T') start"
main
rc=$?
print "== $(date '+%F %T') finished (exit $rc)"
exit $rc
