const upgradeTwimgUrl = (url) => {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'pbs.twimg.com') {
      parsed.searchParams.set('name', 'orig');
      return parsed.toString();
    }
  } catch {
    return url;
  }
  return url;
};

export const collectImages = async () => {
  const article = document.querySelector('article[data-testid="tweet"]');
  if (!article) return null;
  const imageUrls = Array.from(new Set(
    Array.from(article.querySelectorAll('img[src*="pbs.twimg.com/media/"]'))
      .map((img) => img.currentSrc || img.src)
      .filter(Boolean)
      .map(upgradeTwimgUrl),
  ));
  if (imageUrls.length === 0) return null;
  return { imageUrls, pageUrl: location.href, pageTitle: document.title };
};
