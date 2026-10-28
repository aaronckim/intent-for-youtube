#!/bin/zsh
# Installs the launchd job that runs scripts/local-canary.sh every day at 09:30 local time
# (or on next wake, if the Mac was asleep). Re-run after changing Node versions, since the job
# keeps the PATH from the shell that installed it.
#
#   zsh scripts/install-local-canary.sh             install, or reinstall
#   zsh scripts/install-local-canary.sh --uninstall remove the job (the clone and logs stay)
set -e

LABEL=com.github.aaronckim.intent-canary
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
BASE="$HOME/Library/Application Support/intent-canary"
LOGS="$HOME/Library/Logs/intent-canary"
DOMAIN="gui/$(id -u)"

if [[ "$1" == "--uninstall" ]]; then
  launchctl bootout "$DOMAIN/$LABEL" 2> /dev/null || true
  rm -f "$PLIST"
  print "Removed $LABEL. Its clone ($BASE) and logs ($LOGS) are still there."
  exit 0
fi

for tool in node npm gh git; do
  command -v "$tool" > /dev/null || { print "Missing $tool on PATH." >&2; exit 1; }
done
gh auth status > /dev/null 2>&1 || { print "Run 'gh auth login' first." >&2; exit 1; }

mkdir -p "$BASE" "$LOGS" "$HOME/Library/LaunchAgents"
[[ -d "$BASE/repo/.git" ]] || git clone -q https://github.com/aaronckim/intent-for-youtube.git "$BASE/repo"

xml() { print -r -- "$1" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g'; }

cat > "$PLIST" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>$(xml "$BASE/repo/scripts/local-canary.sh")</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key><integer>9</integer>
    <key>Minute</key><integer>30</integer>
  </dict>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>$(xml "$PATH")</string>
  </dict>
  <key>StandardOutPath</key><string>$(xml "$LOGS/launchd.log")</string>
  <key>StandardErrorPath</key><string>$(xml "$LOGS/launchd.log")</string>
</dict>
</plist>
EOF
plutil -lint -s "$PLIST"

launchctl bootout "$DOMAIN/$LABEL" 2> /dev/null || true
launchctl bootstrap "$DOMAIN" "$PLIST"
print "Installed $LABEL: runs daily at 09:30. Logs: $LOGS"
print "Run it now with: launchctl kickstart $DOMAIN/$LABEL"
