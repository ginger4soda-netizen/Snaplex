import { isInjectablePageUrl } from "../util/url.js";

const BADGE_TIMEOUT_MS = 1500;

const TONES = {
  saved: {
    badgeText: "OK",
    badgeColor: "#1f8f4d",
    toastColor: "#0f5132",
    toastBackground: "#dff3e8",
    toastBorder: "#b9e2cb"
  },
  duplicate: {
    badgeText: "AD",
    badgeColor: "#b7791f",
    toastColor: "#664d03",
    toastBackground: "#fff1c7",
    toastBorder: "#ead07b"
  },
  failed: {
    badgeText: "!",
    badgeColor: "#b4232f",
    toastColor: "#842029",
    toastBackground: "#f8d7da",
    toastBorder: "#edb7bd"
  }
};

export async function showFeedback(tab, feedback) {
  const tone = TONES[feedback.tone] || TONES.failed;
  let delivery = "badge";
  if (tab?.id && isInjectablePageUrl(tab.url)) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        args: [feedback.message, tone],
        func: injectSnaplexToast
      });
      if (results?.some((item) => item?.result === true)) {
        delivery = "toast";
        logTiming(feedback, delivery);
        return delivery;
      }
      console.info("[Snaplex] toast injection returned no confirmation; falling back to badge");
    } catch (error) {
      console.info("[Snaplex] toast injection failed; falling back to badge", error?.message || error);
    }
  }

  await flashBadge(feedback.tone);
  logTiming(feedback, delivery);
  return delivery;
}

async function flashBadge(toneName) {
  const tone = TONES[toneName] || TONES.failed;
  await chrome.action.setBadgeBackgroundColor({ color: tone.badgeColor });
  await chrome.action.setBadgeText({ text: tone.badgeText });
  setTimeout(() => {
    void chrome.action.setBadgeText({ text: "" });
  }, BADGE_TIMEOUT_MS);
}

function logTiming(feedback, delivery) {
  if (typeof feedback.startedAtMs !== "number") {
    return;
  }

  const elapsedMs = Math.round(performance.now() - feedback.startedAtMs);
  console.info("[Snaplex] capture feedback", {
    type: feedback.captureType || "unknown",
    tone: feedback.tone,
    delivery,
    elapsedMs
  });
}

function injectSnaplexToast(message, tone) {
  const hostId = "snaplex-extension-toast-host";
  document.getElementById(hostId)?.remove();

  const host = document.createElement("div");
  host.id = hostId;
  host.style.position = "fixed";
  host.style.right = "18px";
  host.style.bottom = "18px";
  host.style.zIndex = "2147483647";

  const shadow = host.attachShadow({ mode: "closed" });
  const toast = document.createElement("div");
  toast.textContent = message;
  toast.style.maxWidth = "320px";
  toast.style.padding = "10px 12px";
  toast.style.border = `1px solid ${tone.toastBorder}`;
  toast.style.borderRadius = "8px";
  toast.style.color = tone.toastColor;
  toast.style.background = tone.toastBackground;
  toast.style.boxShadow = "0 10px 30px rgba(17, 24, 39, 0.16)";
  toast.style.font = '13px/1.4 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  toast.style.fontWeight = "650";
  toast.style.letterSpacing = "0";

  shadow.append(toast);
  document.documentElement.append(host);
  setTimeout(() => host.remove(), 1800);
  return true;
}
