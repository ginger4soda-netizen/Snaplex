# Snaplex Browser Extension

Developer-mode extension for capturing browser images, screenshots, and video frames into Snaplex Desktop through Chrome Native Messaging.

## Build

```sh
cd extension
pnpm install
pnpm build
```

The loadable extension is written to `extension/dist`.

## Load In Chrome

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Choose Load unpacked.
4. Select `extension/dist`.
5. Copy the generated extension ID.

## Native Messaging Dev Manifest

All paths below are relative to the `snaplex/` directory.

Build the desktop workspace first:

```sh
cd src-tauri
cargo build -p snaplex-bridge
```

Then install a development Native Messaging manifest with the extension ID from Chrome:

```sh
cd ..   # back to snaplex/
scripts/install-dev-manifest.sh \
  --bridge src-tauri/target/debug/snaplex-bridge \
  --ext-id <extension-id>
```

The Phase 4 script owns the final manifest installation behavior. The production manifest must include the Chrome Web Store extension ID before release.

## Debugging

- Extension service worker logs are visible from `chrome://extensions` by opening the service worker inspector.
- Popup logs are visible by inspecting the popup window.
- Capture feedback logs include user-action-to-feedback timing in milliseconds.
- If toast injection fails on a restricted page, the action badge flashes instead.
- Bridge diagnostics are written to `~/.snaplex/logs/bridge.log`.
- Desktop Settings can export a diagnostics zip containing recent capture records and the bridge log.

## Release Checklist

- Replace the placeholder production extension ID in Desktop manifest generation.
- Prepare Chrome Web Store screenshots, privacy policy, and host-permission explanation.
- Smoke test Chrome, Edge, Brave, and Arc on supported operating systems.
- Verify image capture feedback is under the 500 ms target when Desktop is already running.

