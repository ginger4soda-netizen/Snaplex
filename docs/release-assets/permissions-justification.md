# Permissions Justification — Chrome Web Store Privacy Practices Tab

每一项权限都需要在 Web Store Developer Console 的 Privacy practices → Permission justification 区域逐条回答。下面是逐项文案。

---

## `nativeMessaging` *(the high-scrutiny one)*

```
Snaplex sends every captured image, video frame, and screenshot to a companion desktop application (Snaplex Desktop) running on the same computer, via Chrome's Native Messaging API. The native messaging host is registered locally by the desktop installer and is the only mechanism the extension uses to deliver captures. No HTTP, fetch, or WebSocket calls leave the browser. This permission is the core delivery channel of the extension and the entire single purpose depends on it.
```

## `contextMenus`

```
Adds three right-click menu items: "Save image to Snaplex" (on images), "Save current video frame to Snaplex" (on videos), and "Capture visible area to Snaplex" (on pages). These are the primary user-initiated capture entry points.
```

## `activeTab`

```
When the user invokes the region-screenshot command (keyboard shortcut or popup button), the extension needs to inject the selection overlay into, and read pixels from, only the tab the user is currently looking at. activeTab is requested instead of broader host access so that capture only happens after explicit user action on the active tab.
```

## `scripting`

```
Used together with activeTab to inject the region-selection overlay (a small content script that draws the marquee and reports the chosen rectangle) and the in-page success/failure toast. Scripts are injected only after the user triggers a capture.
```

## `tabs`

```
The extension reads the active tab's title and URL so the saved image can record where it came from in the user's local library (the source page is shown in the desktop app's image detail). It is not used to enumerate browsing history or read content from other tabs.
```

## `storage`

```
Stores small UI preferences for the popup (last-known connection state, locale preference). No captured content and no personal data is persisted in chrome.storage.
```

---

## Host permissions: `<all_urls>`

```
Visual references can come from any website — design portfolios, news articles, social media, internal tools. The extension's right-click menu and region-screenshot must work on every page the user visits, so a broad host pattern is required. The extension does not read page content automatically: scripts are injected only after the user explicitly clicks a context menu item, presses the keyboard shortcut, or clicks a popup button.
```

---

## Remote code

In the question **"Are you using remote code?"** answer:

```
No
```

Justification (free text if asked):

```
The extension does not load or execute any remotely-hosted scripts, WebAssembly, or eval'd code. All JavaScript runs from files bundled in the extension package.
```

---

## Single purpose (echo of store-listing)

```
Capture images, video frames, and region screenshots from web pages and deliver them — via a local Native Messaging channel — to the user's own Snaplex Desktop application on the same computer.
```

---

## Reviewer note (optional, but recommended for `nativeMessaging` items)

In Developer Console → "Notes for the reviewer" paste:

```
This extension is the browser-side companion to Snaplex Desktop, an open-source visual reference manager that runs locally. Captures travel only over Chrome's Native Messaging API to a host process registered by the desktop installer (com.snaplex.host). Nothing is uploaded to the network.

To test end-to-end you would need Snaplex Desktop installed; without it the popup correctly shows "Snaplex Desktop is not reachable" and all capture actions fail with a user-visible toast — there is no silent failure.

Source code: https://github.com/<your-org>/snaplex (replace before publish)
Native messaging host manifest registration: handled by the desktop installer at ~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.snaplex.host.json (macOS).
```
