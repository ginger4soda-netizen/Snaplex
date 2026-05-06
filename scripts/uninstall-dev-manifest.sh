#!/usr/bin/env bash
set -euo pipefail

HOST_NAME="com.snaplex.host"
REMOVE_ALL=0

if [[ "${1:-}" == "--all-browsers" ]]; then
  REMOVE_ALL=1
elif [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  echo "Usage: scripts/uninstall-dev-manifest.sh [--all-browsers]"
  exit 0
elif [[ $# -gt 0 ]]; then
  echo "Unknown argument: $1" >&2
  exit 2
fi

remove_manifest() {
  local browser_root="$1"
  local manifest_path="$browser_root/NativeMessagingHosts/$HOST_NAME.json"
  if [[ -f "$manifest_path" ]]; then
    rm "$manifest_path"
    echo "Removed $manifest_path"
  fi
}

case "$(uname -s)" in
  Darwin)
    remove_manifest "$HOME/Library/Application Support/Google/Chrome"
    if [[ "$REMOVE_ALL" -eq 1 ]]; then
      for browser_root in \
        "$HOME/Library/Application Support/Microsoft Edge" \
        "$HOME/Library/Application Support/BraveSoftware/Brave-Browser" \
        "$HOME/Library/Application Support/Arc/User Data"; do
        remove_manifest "$browser_root"
      done
    fi
    ;;
  Linux)
    remove_manifest "$HOME/.config/google-chrome"
    if [[ "$REMOVE_ALL" -eq 1 ]]; then
      for browser_root in \
        "$HOME/.config/microsoft-edge" \
        "$HOME/.config/BraveSoftware/Brave-Browser" \
        "$HOME/.config/chromium"; do
        remove_manifest "$browser_root"
      done
    fi
    ;;
  *)
    echo "Unsupported OS for this script. Use scripts/uninstall-dev-manifest.ps1 on Windows." >&2
    exit 2
    ;;
esac
