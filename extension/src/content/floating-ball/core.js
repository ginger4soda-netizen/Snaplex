const buildIcon = () => {
  const img = document.createElement('img');
  img.className = 'snaplex-floating-ball-logo';
  img.alt = '';
  img.draggable = false;
  try {
    img.src = chrome.runtime.getURL('icons/48.png');
  } catch {
    img.src = '';
  }
  return img;
};

export const isCaptureCandidate = (img) => {
  if (!(img instanceof HTMLImageElement)) return false;
  if (img.dataset.snaplexIgnore === '1') return false;
  if (img.naturalWidth < 200 || img.naturalHeight < 200) return false;
  const src = img.currentSrc || img.src;
  if (!src) return false;
  if (src.startsWith('blob:') || src.startsWith('data:')) return false;
  return true;
};

export const mountFloatingBall = ({ trigger }) => {
  const ball = document.createElement('div');
  ball.className = 'snaplex-floating-ball';
  ball.setAttribute('role', 'button');
  ball.setAttribute('aria-label', 'Send to Snaplex');
  ball.appendChild(buildIcon());
  document.documentElement.appendChild(ball);

  let activeImage = null;
  let dismissedFor = null;

  const showToast = (message, tone = 'info') => {
    const toast = document.createElement('div');
    toast.className = 'snaplex-toast';
    toast.dataset.tone = tone;
    toast.textContent = message;
    document.documentElement.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('is-visible'));
    setTimeout(() => {
      toast.classList.remove('is-visible');
      setTimeout(() => toast.remove(), 220);
    }, 2400);
  };

  const positionBall = (img) => {
    const rect = img.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      ball.classList.remove('is-visible');
      return;
    }
    ball.style.top = `${rect.top + window.scrollY + 8}px`;
    ball.style.left = `${rect.right + window.scrollX - 44}px`;
    ball.classList.add('is-visible');
  };

  const setActive = (img) => {
    activeImage = img;
    if (img) positionBall(img);
    else ball.classList.remove('is-visible');
  };

  const reposition = () => {
    if (activeImage) positionBall(activeImage);
  };
  window.addEventListener('scroll', reposition, { passive: true });
  window.addEventListener('resize', reposition);

  if (!window.__snaplexHistoryWrapped) {
    window.__snaplexHistoryWrapped = true;
    for (const method of ['pushState', 'replaceState']) {
      const original = history[method];
      history[method] = function (...args) {
        const result = original.apply(this, args);
        window.dispatchEvent(new Event('snaplex:locationchange'));
        return result;
      };
    }
    window.addEventListener('popstate', () => window.dispatchEvent(new Event('snaplex:locationchange')));
  }
  const onLocationChange = () => setActive(null);
  window.addEventListener('snaplex:locationchange', onLocationChange);

  let onMouseOver;
  let onMouseOut;
  let onDocumentClick;

  if (trigger === 'hover') {
    onMouseOver = (event) => {
      if (isCaptureCandidate(event.target)) setActive(event.target);
    };
    onMouseOut = (event) => {
      if (event.relatedTarget === ball) return;
      if (activeImage && !activeImage.matches(':hover')) setActive(null);
    };
    document.addEventListener('mouseover', onMouseOver, true);
    document.addEventListener('mouseout', onMouseOut, true);
  } else {
    onDocumentClick = (event) => {
      if (event.target === ball || ball.contains(event.target)) return;
      if (event.target instanceof HTMLImageElement && isCaptureCandidate(event.target)) {
        if (dismissedFor === event.target) {
          dismissedFor = null;
          setActive(null);
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        setActive(event.target);
      } else if (activeImage) {
        dismissedFor = activeImage;
        setActive(null);
      }
    };
    document.addEventListener('click', onDocumentClick, true);
  }

  const onWindowBlur = () => setActive(null);
  window.addEventListener('blur', onWindowBlur);

  ball.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!activeImage) return;
    const srcUrl = activeImage.currentSrc || activeImage.src;
    if (!srcUrl) {
      showToast('Snaplex: image source unavailable', 'error');
      return;
    }
    ball.classList.add('is-busy');
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'snaplex:capture-image-by-url',
        srcUrl,
      });
      if (response?.ok) {
        showToast('Snaplex: sent');
      } else {
        const code = response?.response?.code || response?.code || 'image_fetch_failed';
        showToast(`Snaplex: ${code}`, 'error');
      }
    } catch (error) {
      showToast(`Snaplex: ${error?.message || 'failed'}`, 'error');
    } finally {
      ball.classList.remove('is-busy');
    }
  });

  return () => {
    if (onMouseOver) document.removeEventListener('mouseover', onMouseOver, true);
    if (onMouseOut) document.removeEventListener('mouseout', onMouseOut, true);
    if (onDocumentClick) document.removeEventListener('click', onDocumentClick, true);
    window.removeEventListener('blur', onWindowBlur);
    window.removeEventListener('scroll', reposition);
    window.removeEventListener('resize', reposition);
    window.removeEventListener('snaplex:locationchange', onLocationChange);
    ball.remove();
  };
};
