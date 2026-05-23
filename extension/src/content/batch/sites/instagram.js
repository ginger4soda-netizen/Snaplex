export const collectImages = async () => {
  const article = document.querySelector('article[role="presentation"], article');
  if (!article) return null;

  const urls = Array.from(article.querySelectorAll('img[srcset], img[src*="cdninstagram"], img[src*="fbcdn"]'))
    .map((img) => {
      const srcset = img.getAttribute('srcset');
      if (srcset) {
        const candidates = srcset.split(',').map((candidate) => candidate.trim());
        const url = (candidates[candidates.length - 1] || '').split(' ')[0];
        if (url) return url;
      }
      return img.currentSrc || img.src;
    })
    .filter(Boolean);

  const imageUrls = Array.from(new Set(urls));
  if (imageUrls.length === 0) return null;
  return { imageUrls, pageUrl: location.href, pageTitle: document.title };
};
