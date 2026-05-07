# XHS Context Menu Discovery

Issue: #3
Date: 2026-05-07
Status: Discovery only. No implementation in this phase.

## Scope and Evidence

This document is based on code audit plus browser-extension platform behavior. I could not install the unpacked extension and live-test Xiaohongshu/RedNote pages from this environment, so the reproduction matrix below is a hypothesis to verify manually before implementation.

Relevant code:
- `extension/src/background/index.js`: registers Snaplex context-menu items only for Chrome context `"image"`, `"page"`, and `"video"`.
- `extension/src/background/capture-image.js`: image action requires `info.srcUrl`; fallback canvas path can only find a real `document.images` element matching that URL.
- `extension/src/background/capture-screenshot.js`: visible/region screenshot path already exists and can capture the visible tab/selected viewport rectangle.

Platform facts:
- Chrome extension context menu contexts include `"image"`, `"page"`, and `"video"`; the `"image"` item is only available when the browser classifies the right-click target as an image element.
- Websites can suppress the browser menu by cancelling `contextmenu` events.
- If the visual is rendered as CSS background, canvas, blob, or a framework wrapper instead of an `<img>` hit target, Snaplex's current `"image"` context item does not receive a usable `srcUrl`.

Sources:
- Chrome contextMenus API: https://developer.chrome.com/docs/extensions/reference/api/contextMenus
- Chrome context menu UI guide: https://developer.chrome.com/docs/extensions/develop/ui/context-menu

## Reproduction Matrix to Run Manually

| Scenario | Expected current result | Likely failure mode | Evidence to collect |
|---|---|---|---|
| XHS image detail page, right-click directly over displayed image | Snaplex image menu absent, or menu appears but capture fails | Site intercepts `contextmenu`, or target is not a real `<img>` with stable `srcUrl` | DevTools event listener breakpoint on `contextmenu`; inspect clicked node; record `info.srcUrl` if menu fires |
| XHS feed/grid image, right-click over card image | Snaplex image menu often absent | Card media may be CSS background or nested non-image layer | Inspect DOM under pointer; check `document.elementFromPoint()` and closest image/background URL |
| XHS page context menu item "Capture visible area" | Should be available if native menu opens | If site prevents native menu, no context-menu path at all | Verify whether browser menu opens with page item |
| Region screenshot shortcut/popup button | Should work independent of site image DOM | Needs user to select region; metadata is page URL, not original image URL | Verify overlay injection and crop result |

## Technical Options

### A. Content-script hover action on XHS media

Inject a site-specific content script on `*.xiaohongshu.com` / RedNote domains. Detect media under pointer, render a small Snaplex floating button, and send a message to background when clicked.

Implementation notes:
- Use `document.elementFromPoint()` and composed path inspection.
- Candidate extraction order:
  - `<img currentSrc/src>`
  - `<picture> img`
  - CSS `background-image: url(...)`
  - high-resolution URL from nearby DOM attributes if present
  - fallback to region screenshot rect for the visible media box
- Preserve semantics:
  - `source_url`: original image URL when extracted
  - `page_url`: current note/feed page URL
  - `page_title`: tab title
  - `type_specific`: include `xhsCandidateSource` (`img`, `background`, `dom-attr`, `region-fallback`) and bounding rect
- UX:
  - hover button only appears over media candidates
  - no forced right-click override
  - works even if XHS prevents native context menu

Pros:
- Best chance to preserve original image URL.
- Avoids fighting site context-menu interception.
- Can be limited to XHS domains.

Cons:
- Site-specific DOM heuristics can break.
- Needs careful styling/isolation so the overlay does not interfere with site controls.

### B. Region screenshot fallback from context/popup

Use the existing region screenshot overlay and treat XHS as a screenshot-first site. Users select the image region manually.

Implementation notes:
- Add XHS-specific guidance in popup or failure feedback: use region screenshot when image context menu is unavailable.
- Existing `captureRegionScreenshot` already stores page URL/title and rect metadata.

Pros:
- Low implementation risk.
- Does not depend on XHS image URL structure.
- Uses browser-supported visible-tab capture.

Cons:
- Loses original image URL.
- Captures viewport pixels only; result may include UI overlays, compression, or cropped visible state.
- Manual selection adds friction.

### C. Hybrid: hover button with original-image attempt, then region fallback

Implement option A, but if no stable image URL can be extracted or fetch/canvas capture fails, automatically call the region screenshot path using the detected media bounding rect.

Pros:
- Best UX and broadest coverage.
- Preserves original image URL when possible while still succeeding for canvas/background/rendered-only cases.

Cons:
- Higher complexity.
- Needs clear metadata so users can distinguish original-image capture from screenshot fallback.

## Recommendation

Choose option C for implementation after manual reproduction confirms the right-click path is blocked or unreliable.

Rationale:
- The current extension already has robust native messaging, image capture, and region screenshot primitives.
- XHS appears to need a site-specific entry point more than a change to the generic Chrome context-menu handler.
- A hybrid flow preserves semantic source data when available but avoids making success dependent on XHS DOM internals.

## Open Questions for User Confirmation

- Is screenshot-quality capture acceptable on XHS when the original image URL is not extractable?
- Should the XHS hover action be enabled only on explicit user opt-in, or always for XHS pages after extension install?
- Should feed cards and detail pages be treated equally, or should implementation prioritize detail pages first?

