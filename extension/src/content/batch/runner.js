const uuid = () => {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const mountBatchRunner = ({ collectImages, label }) => {
  document.querySelectorAll('.snaplex-batch-button, .snaplex-batch-progress').forEach((node) => {
    node.remove();
  });

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'snaplex-batch-button';
  button.textContent = label;
  document.documentElement.appendChild(button);

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'snaplex:trigger-batch-transfer') {
      button.click();
      sendResponse({ ok: true });
      return true;
    }
    return undefined;
  });

  let progressNode = null;

  const renderProgress = ({ done, total, failed, finalMessage }) => {
    if (!progressNode) {
      progressNode = document.createElement('div');
      progressNode.className = 'snaplex-batch-progress';
      document.documentElement.appendChild(progressNode);
    }
    while (progressNode.firstChild) progressNode.removeChild(progressNode.firstChild);

    const main = document.createElement('div');
    main.textContent = finalMessage || `Snaplex: ${done}/${total} sent`;
    progressNode.appendChild(main);

    if (failed > 0) {
      const sub = document.createElement('small');
      sub.textContent = `${failed} failed`;
      progressNode.appendChild(sub);
    }
  };

  const dismissProgress = (delay = 3000) => {
    if (!progressNode) return;
    const node = progressNode;
    progressNode = null;
    setTimeout(() => node.remove(), delay);
  };

  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      const collected = await collectImages();
      if (!collected?.imageUrls?.length) {
        renderProgress({ done: 0, total: 0, failed: 0, finalMessage: 'Snaplex: no images detected; try right-click on a single image' });
        dismissProgress();
        return;
      }

      const batchId = uuid();
      const total = collected.imageUrls.length;
      let done = 0;
      let failed = 0;
      renderProgress({ done, total, failed });

      for (let index = 0; index < total; index += 1) {
        try {
          const response = await chrome.runtime.sendMessage({
            type: 'snaplex:capture-image-by-url',
            srcUrl: collected.imageUrls[index],
            batch: { id: batchId, index, total },
          });
          if (response?.ok) done += 1;
          else failed += 1;
        } catch {
          failed += 1;
        }
        renderProgress({ done, total, failed });
      }

      renderProgress({
        done,
        total,
        failed,
        finalMessage: failed === 0 ? `Snaplex: sent ${done}` : `Snaplex: ${done} of ${total} sent`,
      });
      dismissProgress();
    } finally {
      button.disabled = false;
    }
  });

  return () => {
    button.remove();
    if (progressNode) progressNode.remove();
  };
};
