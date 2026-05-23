# Chrome Web Store Listing — English

Copy-paste fields below into the Web Store Developer Console.

---

## Item name (max 75 chars)

```
Snaplex — Save images, frames, and screenshots to your local library
```

(67 chars)

## Summary / Short description (max 132 chars)

```
Save images, video frames, and region screenshots from any page to Snaplex Desktop. 100% local — nothing is uploaded to the cloud.
```

(130 chars)

## Category

```
Productivity
```

Secondary suggestion: `Workflow & Planning`

## Language

```
English (default)
```

Add `Chinese (Simplified)` as an additional locale (see [`store-listing-zh.md`](./store-listing-zh.md)).

---

## Detailed description (max 16,000 chars — keep under 1,500 for readability)

```
Snaplex turns your browser into a one-shot capture tool for the visual reference library that lives on your computer.

Right-click any image, capture a video frame mid-playback, or drag out a region screenshot — and it lands in Snaplex Desktop instantly. Nothing is uploaded. Nothing is sent to a server. Captures travel from this extension to the Snaplex Desktop app on your machine over a private local channel.

━━━ What you can capture ━━━

• Images — right-click any picture on a page → Save image to Snaplex
• Video frames — right-click a playing video → Save current video frame to Snaplex
• Region screenshots — press Cmd+Shift+S (Ctrl+Shift+S on Windows/Linux) and drag out the area you want
• Visible area — open the popup → Capture visible area

━━━ Built for designers, researchers, and anyone who collects references ━━━

• Same image saved twice? Snaplex deduplicates by content hash and just appends the new source URL.
• Every capture remembers where it came from — page title, URL, timestamp.
• A toast shows up in the page so you know the save landed without switching apps.

━━━ Privacy is the whole point ━━━

• 100% local. Captures go from this extension → Snaplex Desktop on your computer. That's it.
• No cloud. No analytics. No telemetry.
• No account, no sign-in.
• Open source — see https://github.com/<your-org>/snaplex (replace before publish)

━━━ Requires Snaplex Desktop ━━━

This extension is a companion to Snaplex Desktop (macOS / Linux). Install Snaplex Desktop first from <download URL>, then install this extension. The popup will tell you if Desktop isn't running.

━━━ Keyboard ━━━

• Cmd+Shift+S (mac) / Ctrl+Shift+S (Windows/Linux) — start a region screenshot
• Customize via chrome://extensions/shortcuts

━━━ Support ━━━

Issues, feature requests, feedback: <support URL or email — replace before publish>
```

---

## Single Purpose statement

Required field on the Privacy practices tab.

```
Snaplex captures images, video frames, and region screenshots from web pages and forwards them — over a local Native Messaging channel — to the Snaplex Desktop application running on the same computer, where the user can organize them into a personal visual reference library. The extension does not transmit any data over the network.
```

---

## Permissions justification (paste into Privacy practices)

See [`permissions-justification.md`](./permissions-justification.md) for the per-permission text.

---

## Data usage disclosures

In the **"What user data does your extension collect?"** section, check **none of the following categories** apply:

- Personally identifiable information — **No**
- Health information — **No**
- Financial and payment information — **No**
- Authentication information — **No**
- Personal communications — **No**
- Location — **No**
- Web history — **No**
- User activity — **No**
- Website content — **No** *(rationale: captured images travel to the user's own Desktop app on the same machine and never leave the device. They are not collected by the developer.)*

Then check **all three certifications**:

- ☑ I do not sell or transfer user data to third parties, outside of the approved use cases
- ☑ I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- ☑ I do not use or transfer user data to determine creditworthiness or for lending purposes

---

## Distribution

- **Visibility**: start with **Unlisted** for the first submission. Switch to **Public** only after retrieving the assigned extension ID and rebuilding Snaplex Desktop with that ID baked into [`app/src/transport/manifest.rs`](../../src-tauri/app/src/transport/manifest.rs).
- **Regions**: All regions
- **Pricing**: Free
