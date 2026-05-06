# Snaplex Browser Extension — Privacy Policy

**Effective date:** 2026-05-05
**Last updated:** 2026-05-05

This page describes how the Snaplex browser extension (the "Extension") handles data. The Extension is a companion to **Snaplex Desktop**, an application that runs on the user's own computer.

---

## TL;DR

- The Extension does **not** collect, transmit, sell, share, or store user data on any remote server.
- Every image, video frame, or screenshot you capture goes from the Extension to the **Snaplex Desktop application running on the same computer**, via Chrome's local Native Messaging API.
- There is no account, no sign-in, no analytics, no telemetry, no advertising, no third-party SDK.

---

## What the Extension does

When you trigger a capture (right-click menu, keyboard shortcut, or popup button), the Extension:

1. Reads the relevant pixels (the image you clicked, a frame from the playing video, or the rectangle you selected on screen).
2. Reads the active tab's URL and title so the capture remembers where it came from.
3. Hands the captured bytes plus the source URL/title to **Snaplex Desktop** through Chrome's Native Messaging API. Native Messaging is an OS-local IPC mechanism — the data stays inside your computer.

That is the entire data flow.

## What is **not** sent anywhere

- The Extension makes no HTTP / fetch / WebSocket calls. There is no server endpoint operated by us.
- The Extension does not include analytics SDKs (no Google Analytics, no Sentry, no Segment, no Mixpanel, no Amplitude, no Firebase).
- The Extension does not include advertising or tracking pixels.

## Permissions and why we need them

| Permission | Why |
|---|---|
| `nativeMessaging` | The only delivery channel the Extension uses — sends captures to the local Snaplex Desktop process. |
| `contextMenus` | Adds the right-click "Save to Snaplex" menu items. |
| `activeTab` + `scripting` | Injects the region-selection overlay and on-page status toast — only after you explicitly trigger a capture. |
| `tabs` | Reads the current tab's URL and title so the capture remembers its origin. |
| `storage` | Persists small UI preferences (last-known connection state, locale). No captured content is stored here. |
| `host_permissions: <all_urls>` | Visual references can come from any site, so the right-click menu and region screenshot must work on all pages. The Extension does not read page content until you trigger a capture. |

## Storage and retention

- Captured content is stored in the **Snaplex Desktop library on your local disk**. The Extension itself does not retain captured content; once it has been handed to Snaplex Desktop, the in-memory copy is discarded.
- Small UI preferences (≤ 1 KB) are kept in `chrome.storage.local` on your device.

## Children's privacy

The Extension does not knowingly collect any data from anyone, including children under 13.

## Third parties

The Extension does not share, sell, rent, transfer, or disclose any user data to third parties — because it does not collect any to begin with.

## Open source

Snaplex is open source. You can audit the network behavior, the Native Messaging payload format, and every line of code at:

```
https://github.com/<your-org>/snaplex
```

(Replace before publishing.)

## Changes to this policy

If this policy ever changes (for example, if a future version of the Extension adds an optional cloud-sync feature), the change will be announced in the extension's release notes and at the URL above. Material changes will require explicit user opt-in.

## Contact

Questions, security reports, or privacy concerns:

```
<email or GitHub Issues link — replace before publish>
```
