#!/usr/bin/env bash
set -euo pipefail

HOST_NAME="com.snaplex.host"
EXT_ID_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)/extension/scripts/dev-extension-id.txt"

BRIDGE=""
EXT_ID=""
INSTALL_ALL=0

usage() {
  cat <<USAGE
Usage: scripts/install-dev-manifest.sh --bridge <path> [--ext-id <chrome-extension-id>] [--all-browsers]

Options:
  --bridge        Path to target/debug/snaplex-bridge or release binary.
  --ext-id        Chrome extension ID. If omitted, reads extension/scripts/dev-extension-id.txt.
  --all-browsers  Also write manifests for detected Edge, Brave, Arc, and Chromium profiles.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --bridge)
      BRIDGE="${2:-}"
      shift 2
      ;;
    --ext-id)
      EXT_ID="${2:-}"
      shift 2
      ;;
    --all-browsers)
      INSTALL_ALL=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ -z "$BRIDGE" ]]; then
  echo "Missing required --bridge argument." >&2
  usage >&2
  exit 2
fi

if [[ -z "$EXT_ID" && -f "$EXT_ID_FILE" ]]; then
  EXT_ID="$(tr -d '[:space:]' < "$EXT_ID_FILE")"
fi

if [[ ! "$EXT_ID" =~ ^[a-p]{32}$ ]]; then
  echo "Invalid or missing extension ID. Pass --ext-id or write it to $EXT_ID_FILE." >&2
  exit 2
fi

if [[ ! -f "$BRIDGE" ]]; then
  echo "Bridge binary does not exist: $BRIDGE" >&2
  exit 2
fi

BRIDGE_DIR="$(cd "$(dirname "$BRIDGE")" && pwd -P)"
BRIDGE_PATH="$BRIDGE_DIR/$(basename "$BRIDGE")"

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

write_manifest() {
  local browser_root="$1"
  local manifest_dir="$browser_root/NativeMessagingHosts"
  local manifest_path="$manifest_dir/$HOST_NAME.json"
  mkdir -p "$manifest_dir"
  cat > "$manifest_path" <<JSON
{
  "name": "$HOST_NAME",
  "description": "Snaplex Native Messaging Host",
  "path": "$(json_escape "$BRIDGE_PATH")",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$EXT_ID/"
  ]
}
JSON
  echo "Installed $manifest_path"
}

case "$(uname -s)" in
  Darwin)
    write_manifest "$HOME/Library/Application Support/Google/Chrome"
    if [[ "$INSTALL_ALL" -eq 1 ]]; then
      for browser_root in \
        "$HOME/Library/Application Support/Microsoft Edge" \
        "$HOME/Library/Application Support/BraveSoftware/Brave-Browser" \
        "$HOME/Library/Application Support/Arc/User Data"; do
        [[ -d "$browser_root" ]] && write_manifest "$browser_root"
      done
    fi
    ;;
  Linux)
    write_manifest "$HOME/.config/google-chrome"
    if [[ "$INSTALL_ALL" -eq 1 ]]; then
      for browser_root in \
        "$HOME/.config/microsoft-edge" \
        "$HOME/.config/BraveSoftware/Brave-Browser" \
        "$HOME/.config/chromium"; do
        [[ -d "$browser_root" ]] && write_manifest "$browser_root"
      done
    fi
    ;;
  *)
    echo "Unsupported OS for this script. Use scripts/install-dev-manifest.ps1 on Windows." >&2
    exit 2
    ;;
esac
