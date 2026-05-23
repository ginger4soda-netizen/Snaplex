const upgradeWeiboUrl = (url) => url.replace(/\/(orj360|orj480|mw690|mw1024|bmiddle|thumbnail|wap360)\//, '/large/');

export const collectImages = async () => {
  const detail = document.querySelector('article, .Feed_body_3R0rO, .WB_feed_detail');
  const root = detail || document.body;
  const urls = Array.from(root.querySelectorAll('img'))
    .filter((img) => img instanceof HTMLImageElement && (img.naturalWidth >= 200 || img.dataset.src))
    .map((img) => img.currentSrc || img.src || img.dataset.src)
    .filter(Boolean)
    .map(upgradeWeiboUrl);

  const imageUrls = Array.from(new Set(urls));
  if (imageUrls.length === 0) return null;
  return { imageUrls, pageUrl: location.href, pageTitle: document.title };
};
