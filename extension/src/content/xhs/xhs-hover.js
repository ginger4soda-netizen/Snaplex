(() => {
  if (window.__snaplexXhsHoverInstalled) {
    return;
  }
  window.__snaplexXhsHoverInstalled = true;

  const PROBE_THROTTLE_MS = 60;
  const HIDE_DELAY_MS = 200;
  const RESULT_LINGER_MS = 1100;
  const BUTTON_HEIGHT = 28;
  const BUTTON_OFFSET = 8;
  const MIN_CANDIDATE_SIZE = 64;
  const ANCESTOR_LIMIT = 8;

  const DEFAULT_LABELS = {
    capture: "保存到 Snaplex / Save to Snaplex",
    sending: "发送中… / Sending…",
    sent: "已发送 / Sent",
    fallback: "原图不可用，已截图 / Image unavailable — screenshot sent",
    failed: "发送失败 / Send failed"
  };

  let labels = { ...DEFAULT_LABELS };
  let probeQueued = false;
  let lastProbeAt = 0;
  let pendingPointer = null;
  let currentCandidate = null;
  let hideTimer = null;
  let host = null;
  let shadow = null;
  let buttonEl = null;
  let buttonStateEl = null;
  let busy = false;

  void requestLabels();
  document.addEventListener("mousemove", onMouseMove, { capture: true, passive: true });
  document.addEventListener("scroll", onViewportChange, { capture: true, passive: true });
  window.addEventListener("resize", onViewportChange, { passive: true });
  window.addEventListener("blur", scheduleHide, { passive: true });

  async function requestLabels() {
    try {
      const reply = await chrome.runtime.sendMessage({ type: "snaplex:get-xhs-labels" });
      if (reply && reply.ok && reply.labels) {
        labels = { ...DEFAULT_LABELS, ...reply.labels };
        if (buttonEl) {
          buttonEl.title = labels.capture;
        }
      }
    } catch {
      // Background may be initialising; defaults are already applied.
    }
  }

  function onMouseMove(event) {
    pendingPointer = { x: event.clientX, y: event.clientY };
    if (probeQueued) {
      return;
    }
    const elapsed = performance.now() - lastProbeAt;
    const wait = elapsed >= PROBE_THROTTLE_MS ? 0 : PROBE_THROTTLE_MS - elapsed;
    probeQueued = true;
    setTimeout(() => {
      probeQueued = false;
      lastProbeAt = performance.now();
      runProbe();
    }, wait);
  }

  function runProbe() {
    if (busy || !pendingPointer) {
      return;
    }
    if (isOnHoverButton(pendingPointer)) {
      cancelHide();
      return;
    }
    const target = document.elementFromPoint(pendingPointer.x, pendingPointer.y);
    if (!target) {
      scheduleHide();
      return;
    }
    const candidate = findCandidate(target);
    if (!candidate) {
      scheduleHide();
      return;
    }
    if (sameCandidate(candidate, currentCandidate)) {
      cancelHide();
      positionButton(candidate.rect);
      return;
    }
    currentCandidate = candidate;
    showButton(candidate);
  }

  function findCandidate(start) {
    const path = ancestorChain(start, ANCESTOR_LIMIT);
    for (const node of path) {
      if (!(node instanceof Element)) {
        continue;
      }
      const tag = node.tagName;

      if (tag === "IMG") {
        const rect = node.getBoundingClientRect();
        if (rectTooSmall(rect)) {
          continue;
        }
        const src = readImgSrc(node);
        if (src) {
          return { source: "img", srcUrl: absolutize(src, node), rect, anchor: node };
        }
        const attrSrc = readAttrSrc(node);
        if (attrSrc) {
          return {
            source: "dom-attr",
            srcUrl: absolutize(attrSrc, node),
            rect,
            anchor: node
          };
        }
      } else if (tag === "PICTURE") {
        const img = node.querySelector("img");
        if (img) {
          const rect = img.getBoundingClientRect();
          if (!rectTooSmall(rect)) {
            const src = readImgSrc(img);
            if (src) {
              return { source: "img", srcUrl: absolutize(src, img), rect, anchor: img };
            }
          }
        }
      } else if (tag === "CANVAS") {
        const rect = node.getBoundingClientRect();
        if (!rectTooSmall(rect)) {
          return {
            source: "region-fallback",
            srcUrl: null,
            rect,
            anchor: node,
            reason: "canvas"
          };
        }
      }

      const computed = readComputedStyle(node);
      const bg = computed && computed.backgroundImage;
      if (bg && bg !== "none") {
        const url = readFirstUrl(bg);
        if (url) {
          const rect = node.getBoundingClientRect();
          if (!rectTooSmall(rect)) {
            return {
              source: "background",
              srcUrl: absolutize(url, node),
              rect,
              anchor: node
            };
          }
        }
      }

      const attrSrc = readAttrSrc(node);
      if (attrSrc) {
        const rect = node.getBoundingClientRect();
        if (!rectTooSmall(rect)) {
          return {
            source: "dom-attr",
            srcUrl: absolutize(attrSrc, node),
            rect,
            anchor: node
          };
        }
      }
    }
    return null;
  }

  function ancestorChain(start, limit) {
    const chain = [];
    let node = start;
    let depth = 0;
    while (node && depth < limit) {
      chain.push(node);
      if (node instanceof Document) {
        break;
      }
      const root = node.getRootNode && node.getRootNode();
      const next = node.parentElement || (root && root.host) || null;
      if (!next || next === node) {
        break;
      }
      node = next;
      depth += 1;
    }
    return chain;
  }

  function readComputedStyle(node) {
    const view = (node.ownerDocument && node.ownerDocument.defaultView) || window;
    try {
      return view.getComputedStyle(node);
    } catch {
      return null;
    }
  }

  function rectTooSmall(rect) {
    return !rect || rect.width < MIN_CANDIDATE_SIZE || rect.height < MIN_CANDIDATE_SIZE;
  }

  function readImgSrc(img) {
    const value = (img.currentSrc || img.getAttribute("src") || "").trim();
    return value || null;
  }

  function readAttrSrc(node) {
    if (!node.getAttribute) {
      return null;
    }
    for (const attr of ["data-src", "data-original", "data-image-src", "data-xhs-src"]) {
      const value = node.getAttribute(attr);
      if (value) {
        return value.trim();
      }
    }
    return null;
  }

  function readFirstUrl(backgroundImage) {
    const match = /url\((['"]?)([^'")]+)\1\)/i.exec(backgroundImage);
    return match ? match[2] : null;
  }

  function absolutize(value, node) {
    try {
      const base = (node.ownerDocument && node.ownerDocument.baseURI) || document.baseURI;
      return new URL(value, base).href;
    } catch {
      return value;
    }
  }

  function sameCandidate(a, b) {
    if (!a || !b) {
      return false;
    }
    return a.anchor === b.anchor && a.source === b.source && a.srcUrl === b.srcUrl;
  }

  function ensureHost() {
    if (host) {
      return;
    }
    host = document.createElement("div");
    host.id = "snaplex-xhs-hover-host";
    host.style.position = "fixed";
    host.style.top = "0";
    host.style.left = "0";
    host.style.width = "0";
    host.style.height = "0";
    host.style.margin = "0";
    host.style.padding = "0";
    host.style.border = "0";
    host.style.pointerEvents = "none";
    host.style.zIndex = "2147483646";
    shadow = host.attachShadow({ mode: "closed" });

    const style = document.createElement("style");
    style.textContent = shadowCss();
    const button = document.createElement("button");
    button.type = "button";
    button.className = "snaplex-cap";
    button.title = labels.capture;
    button.dataset.state = "idle";
    button.innerHTML = `<span class="ico" aria-hidden="true"></span><span class="state"></span>`;
    button.addEventListener("click", onButtonClick);
    button.addEventListener("mousedown", (event) => event.stopPropagation());
    button.addEventListener("contextmenu", (event) => event.stopPropagation());
    shadow.append(style, button);
    document.documentElement.append(host);
    buttonEl = button;
    buttonStateEl = button.querySelector(".state");
  }

  function showButton(candidate) {
    ensureHost();
    cancelHide();
    buttonEl.dataset.state = "idle";
    buttonStateEl.textContent = "";
    buttonEl.title = labels.capture;
    buttonEl.style.display = "inline-flex";
    positionButton(candidate.rect);
  }

  function positionButton(rect) {
    if (!buttonEl) {
      return;
    }
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const buttonWidth = buttonEl.offsetWidth || BUTTON_HEIGHT;
    const top = Math.max(BUTTON_OFFSET, Math.min(rect.top + BUTTON_OFFSET, viewportH - BUTTON_HEIGHT - BUTTON_OFFSET));
    const left = Math.max(BUTTON_OFFSET, Math.min(rect.right - buttonWidth - BUTTON_OFFSET, viewportW - buttonWidth - BUTTON_OFFSET));
    buttonEl.style.top = `${top}px`;
    buttonEl.style.left = `${left}px`;
  }

  function scheduleHide() {
    if (busy || hideTimer) {
      return;
    }
    hideTimer = setTimeout(() => {
      hideTimer = null;
      hideButton();
    }, HIDE_DELAY_MS);
  }

  function cancelHide() {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  }

  function hideButton() {
    if (buttonEl) {
      buttonEl.style.display = "none";
      buttonEl.dataset.state = "idle";
      buttonStateEl.textContent = "";
    }
    currentCandidate = null;
  }

  function isOnHoverButton(point) {
    if (!buttonEl || buttonEl.style.display === "none") {
      return false;
    }
    const rect = buttonEl.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return false;
    }
    const pad = 4;
    return (
      point.x >= rect.left - pad &&
      point.x <= rect.right + pad &&
      point.y >= rect.top - pad &&
      point.y <= rect.bottom + pad
    );
  }

  function onViewportChange() {
    if (!currentCandidate || !buttonEl) {
      return;
    }
    const next = currentCandidate.anchor.getBoundingClientRect();
    if (!next.width || !next.height) {
      hideButton();
      return;
    }
    currentCandidate.rect = next;
    positionButton(next);
  }

  async function onButtonClick(event) {
    event.preventDefault();
    event.stopPropagation();
    if (busy) {
      return;
    }
    const candidate = currentCandidate;
    if (!candidate) {
      return;
    }

    busy = true;
    cancelHide();
    setButtonState("sending", labels.sending);

    const payload = {
      candidateSource: candidate.source,
      srcUrl: candidate.srcUrl || null,
      pageUrl: location.href,
      pageTitle: document.title,
      rect: roundedRect(candidate.rect),
      devicePixelRatio: window.devicePixelRatio || 1,
      reason: candidate.reason || null
    };

    let reply = null;
    try {
      reply = await chrome.runtime.sendMessage({ type: "xhs:capture", payload });
    } catch {
      reply = null;
    }

    if (reply && reply.ok && reply.fallback) {
      setButtonState("fallback", labels.fallback);
    } else if (reply && reply.ok) {
      setButtonState("sent", labels.sent);
    } else {
      setButtonState("failed", labels.failed);
    }

    setTimeout(() => {
      busy = false;
      hideButton();
    }, RESULT_LINGER_MS);
  }

  function setButtonState(state, message) {
    if (!buttonEl) {
      return;
    }
    buttonEl.dataset.state = state;
    buttonStateEl.textContent = message || "";
    buttonEl.title = message || labels.capture;
  }

  function roundedRect(rect) {
    return {
      x: Math.max(0, Math.round(rect.left)),
      y: Math.max(0, Math.round(rect.top)),
      w: Math.max(0, Math.round(rect.width)),
      h: Math.max(0, Math.round(rect.height))
    };
  }

  function shadowCss() {
    return `
      :host { all: initial; }
      .snaplex-cap {
        position: fixed;
        display: none;
        align-items: center;
        gap: 6px;
        height: ${BUTTON_HEIGHT}px;
        padding: 0 12px 0 10px;
        margin: 0;
        border: 1px solid rgba(255, 255, 255, 0.85);
        border-radius: ${BUTTON_HEIGHT / 2}px;
        background: linear-gradient(135deg, #126466, #0e4d52);
        color: #ffffff;
        font: 12px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", "PingFang SC", "Hiragino Sans GB", sans-serif;
        font-weight: 600;
        letter-spacing: 0.02em;
        white-space: nowrap;
        cursor: pointer;
        pointer-events: auto;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.32), 0 0 0 1px rgba(0, 0, 0, 0.16);
        opacity: 0.96;
        transition: opacity 120ms ease;
      }
      .snaplex-cap:hover { opacity: 1; }
      .snaplex-cap[data-state="sending"] { background: #4a6f72; cursor: progress; }
      .snaplex-cap[data-state="sent"] { background: #1f8f4d; }
      .snaplex-cap[data-state="fallback"] { background: #b7791f; }
      .snaplex-cap[data-state="failed"] { background: #b4232f; }
      .ico {
        width: 14px;
        height: 14px;
        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><path fill='%23ffffff' d='M2 2.5A1.5 1.5 0 0 1 3.5 1h9A1.5 1.5 0 0 1 14 2.5V11h-3.4l-1.6 3.2L7.4 11H2V2.5zM3.5 2.5V9.5h4.6l.9 1.8.9-1.8h2.6V2.5h-9z'/><circle cx='5.5' cy='5.5' r='1' fill='%23ffffff'/></svg>");
        background-size: contain;
        background-repeat: no-repeat;
        background-position: center;
        flex: none;
      }
      .state:empty { display: none; }
    `;
  }
})();
