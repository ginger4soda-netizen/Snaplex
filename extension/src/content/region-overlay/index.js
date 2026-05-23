(() => {
  if (window.__snaplexRegionOverlayInstalled) {
    return;
  }
  window.__snaplexRegionOverlayInstalled = true;

  const MIN_SIZE = 8;
  const HANDLE_SIZE = 12;
  let active = null;

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "snaplex:start-region-overlay") {
      active?.destroy(false);
      active = createOverlay(message.labels || {});
      sendResponse({ ok: true });
      return true;
    }

    if (message?.type === "snaplex:cancel-region-overlay") {
      active?.destroy(true);
      active = null;
      sendResponse({ ok: true });
      return true;
    }

    return false;
  });

  function createOverlay(labels) {
    const text = {
      save: labels.save || "Save",
      cancel: labels.cancel || "Cancel",
      reselect: labels.reselect || "Reselect",
      tooSmall: labels.tooSmall || "Selection too small"
    };
    const host = document.createElement("div");
    const shadow = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = css();
    const stage = document.createElement("div");
    stage.className = "stage";
    stage.tabIndex = -1;
    stage.innerHTML = `
      <div class="selection" hidden>
        <button class="handle nw" data-handle="nw" aria-label="Resize northwest"></button>
        <button class="handle n" data-handle="n" aria-label="Resize north"></button>
        <button class="handle ne" data-handle="ne" aria-label="Resize northeast"></button>
        <button class="handle e" data-handle="e" aria-label="Resize east"></button>
        <button class="handle se" data-handle="se" aria-label="Resize southeast"></button>
        <button class="handle s" data-handle="s" aria-label="Resize south"></button>
        <button class="handle sw" data-handle="sw" aria-label="Resize southwest"></button>
        <button class="handle w" data-handle="w" aria-label="Resize west"></button>
      </div>
      <div class="toolbar" hidden>
        <span class="hint" hidden>${escapeHtml(text.tooSmall)}</span>
        <button class="save" type="button">${escapeHtml(text.save)}</button>
        <button class="reselect" type="button">${escapeHtml(text.reselect)}</button>
        <button class="cancel" type="button">${escapeHtml(text.cancel)}</button>
      </div>
    `;
    shadow.append(style, stage);
    document.documentElement.append(host);
    document.documentElement.style.cursor = "crosshair";
    document.documentElement.style.userSelect = "none";
    stage.focus();

    const selectionEl = stage.querySelector(".selection");
    const toolbarEl = stage.querySelector(".toolbar");
    const saveEl = stage.querySelector(".save");
    const reselectEl = stage.querySelector(".reselect");
    const cancelEl = stage.querySelector(".cancel");
    const hintEl = stage.querySelector(".hint");

    let state = "idle";
    let rect = null;
    let start = null;
    let drag = null;

    function clampRect(next) {
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;
      const x = Math.min(Math.max(0, next.x), viewportW);
      const y = Math.min(Math.max(0, next.y), viewportH);
      const w = Math.min(Math.max(0, next.w), viewportW - x);
      const h = Math.min(Math.max(0, next.h), viewportH - y);
      return { x, y, w, h };
    }

    function normalize(a, b) {
      return clampRect({
        x: Math.min(a.x, b.x),
        y: Math.min(a.y, b.y),
        w: Math.abs(b.x - a.x),
        h: Math.abs(b.y - a.y)
      });
    }

    function point(event) {
      return {
        x: Math.min(Math.max(0, event.clientX), window.innerWidth),
        y: Math.min(Math.max(0, event.clientY), window.innerHeight)
      };
    }

    function render() {
      if (!rect) {
        selectionEl.hidden = true;
        toolbarEl.hidden = true;
        return;
      }

      selectionEl.hidden = false;
      selectionEl.style.left = `${rect.x}px`;
      selectionEl.style.top = `${rect.y}px`;
      selectionEl.style.width = `${rect.w}px`;
      selectionEl.style.height = `${rect.h}px`;
      const tooSmall = rect.w < MIN_SIZE || rect.h < MIN_SIZE;
      saveEl.disabled = tooSmall;
      hintEl.hidden = !tooSmall;
      toolbarEl.hidden = state !== "preview" && state !== "moving" && state !== "resizing";
      if (!toolbarEl.hidden) {
        const top = rect.y + rect.h + 10;
        const left = Math.min(Math.max(10, rect.x), Math.max(10, window.innerWidth - 246));
        toolbarEl.style.left = `${left}px`;
        toolbarEl.style.top = `${top > window.innerHeight - 46 ? Math.max(10, rect.y - 48) : top}px`;
      }
    }

    function preview() {
      state = "preview";
      render();
    }

    function reselect() {
      state = "idle";
      rect = null;
      start = null;
      drag = null;
      render();
    }

    function selectedFromResize(handle, origin, current) {
      const left = handle.includes("w") ? current.x : origin.x;
      const right = handle.includes("e") ? current.x : origin.x + origin.w;
      const top = handle.includes("n") ? current.y : origin.y;
      const bottom = handle.includes("s") ? current.y : origin.y + origin.h;
      return normalize({ x: left, y: top }, { x: right, y: bottom });
    }

    function onPointerDown(event) {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();

      const handle = event.target?.dataset?.handle;
      const current = point(event);
      if (event.target.closest?.(".toolbar")) {
        return;
      }

      try {
        stage.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is a convenience for drag stability, not a hard requirement.
      }
      if (handle && rect) {
        state = "resizing";
        drag = { handle, origin: { ...rect } };
        return;
      }

      if (event.target === selectionEl && rect && state === "preview") {
        state = "moving";
        drag = {
          origin: { ...rect },
          offset: { x: current.x - rect.x, y: current.y - rect.y }
        };
        return;
      }

      state = "dragging";
      start = current;
      rect = { x: current.x, y: current.y, w: 0, h: 0 };
      render();
    }

    function onPointerMove(event) {
      if (state === "idle" || !rect) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const current = point(event);

      if (state === "dragging") {
        rect = normalize(start, current);
        render();
        return;
      }

      if (state === "moving" && drag) {
        rect = clampRect({
          x: current.x - drag.offset.x,
          y: current.y - drag.offset.y,
          w: drag.origin.w,
          h: drag.origin.h
        });
        render();
        return;
      }

      if (state === "resizing" && drag) {
        rect = selectedFromResize(drag.handle, drag.origin, current);
        render();
      }
    }

    function onPointerUp(event) {
      if (state === "dragging" || state === "moving" || state === "resizing") {
        event.preventDefault();
        event.stopPropagation();
        preview();
      }
      drag = null;
      try {
        stage.releasePointerCapture(event.pointerId);
      } catch {
        // Pointer capture may already be released by the browser.
      }
    }

    async function save() {
      if (!rect || rect.w < MIN_SIZE || rect.h < MIN_SIZE) {
        render();
        return;
      }
      const selected = {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        w: Math.round(rect.w),
        h: Math.round(rect.h)
      };
      destroy(false);
      active = null;
      await chrome.runtime.sendMessage({
        type: "snaplex:region-selected",
        rect: selected,
        dpr: window.devicePixelRatio || 1
      });
    }

    function cancel(notify) {
      destroy(false);
      active = null;
      if (notify) {
        void chrome.runtime.sendMessage({ type: "snaplex:region-cancelled" });
      }
    }

    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        cancel(true);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        void save();
      }
    }

    function destroy(notify) {
      stage.removeEventListener("pointerdown", onPointerDown, true);
      stage.removeEventListener("pointermove", onPointerMove, true);
      stage.removeEventListener("pointerup", onPointerUp, true);
      stage.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("resize", cancelOnViewportChange, true);
      document.documentElement.style.cursor = "";
      document.documentElement.style.userSelect = "";
      host.remove();
      if (notify) {
        void chrome.runtime.sendMessage({ type: "snaplex:region-cancelled" });
      }
    }

    function cancelOnViewportChange() {
      cancel(true);
    }

    stage.addEventListener("pointerdown", onPointerDown, true);
    stage.addEventListener("pointermove", onPointerMove, true);
    stage.addEventListener("pointerup", onPointerUp, true);
    stage.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("resize", cancelOnViewportChange, true);
    saveEl.addEventListener("click", () => void save());
    reselectEl.addEventListener("click", reselect);
    cancelEl.addEventListener("click", () => cancel(true));
    render();

    return {
      destroy
    };
  }

  function css() {
    return `
      .stage {
        position: fixed;
        inset: 0;
        z-index: 2147483646;
        cursor: crosshair;
        user-select: none;
        touch-action: none;
      }
      .selection {
        position: fixed;
        box-sizing: border-box;
        border: 2px solid #ffffff;
        background: rgba(255, 255, 255, 0.08);
        box-shadow: 0 0 0 9999px rgba(8, 14, 18, 0.58), 0 0 0 1px rgba(18, 100, 102, 0.8);
        cursor: move;
      }
      .handle {
        position: absolute;
        width: ${HANDLE_SIZE}px;
        height: ${HANDLE_SIZE}px;
        margin: 0;
        padding: 0;
        border: 2px solid #126466;
        border-radius: 50%;
        background: #ffffff;
      }
      .handle.nw { left: -7px; top: -7px; cursor: nwse-resize; }
      .handle.n { left: calc(50% - 6px); top: -7px; cursor: ns-resize; }
      .handle.ne { right: -7px; top: -7px; cursor: nesw-resize; }
      .handle.e { right: -7px; top: calc(50% - 6px); cursor: ew-resize; }
      .handle.se { right: -7px; bottom: -7px; cursor: nwse-resize; }
      .handle.s { left: calc(50% - 6px); bottom: -7px; cursor: ns-resize; }
      .handle.sw { left: -7px; bottom: -7px; cursor: nesw-resize; }
      .handle.w { left: -7px; top: calc(50% - 6px); cursor: ew-resize; }
      .toolbar {
        position: fixed;
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 36px;
        padding: 6px;
        border: 1px solid #c7d0d1;
        border-radius: 8px;
        background: #ffffff;
        box-shadow: 0 10px 30px rgba(17, 24, 39, 0.16);
        cursor: default;
      }
      .toolbar button {
        min-width: 64px;
        min-height: 30px;
        padding: 0 10px;
        border: 1px solid #b9c4c5;
        border-radius: 6px;
        color: #172026;
        background: #ffffff;
        font: 13px/1.3 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-weight: 650;
        letter-spacing: 0;
      }
      .toolbar button.save {
        color: #ffffff;
        border-color: #126466;
        background: #126466;
      }
      .toolbar button:disabled {
        color: #879294;
        border-color: #d7dddd;
        background: #edf0f0;
      }
      .hint {
        color: #842029;
        font: 12px/1.3 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-weight: 650;
        white-space: nowrap;
      }
    `;
  }

  function escapeHtml(input) {
    return String(input).replace(/[&<>"']/g, (ch) => {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[ch];
    });
  }
})();
