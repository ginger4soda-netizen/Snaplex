import { mountFloatingBall } from '../floating-ball/core.js';

const STORAGE_KEY = 'genericFloatingBallEnabled';
let unmount = null;

const apply = (enabled) => {
  if (enabled && !unmount) {
    if (window.__snaplexFloatingBallUnmount) {
      window.__snaplexFloatingBallUnmount();
    }
    unmount = mountFloatingBall({ trigger: 'click' });
    window.__snaplexFloatingBallUnmount = unmount;
  } else if (!enabled && unmount) {
    unmount();
    unmount = null;
    window.__snaplexFloatingBallUnmount = null;
  }
};

(async () => {
  try {
    const stored = await chrome.storage.sync.get(STORAGE_KEY);
    apply(Boolean(stored[STORAGE_KEY]));
  } catch {
    apply(false);
  }
})();

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'sync') return;
  if (STORAGE_KEY in changes) apply(Boolean(changes[STORAGE_KEY].newValue));
});
