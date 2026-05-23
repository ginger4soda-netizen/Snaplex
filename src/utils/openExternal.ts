import type { MouseEvent } from 'react';
import { isTauri } from './isTauri';

export async function openExternal(url: string): Promise<void> {
  if (!url) return;
  if (isTauri()) {
    try {
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl(url);
      return;
    } catch (error) {
      console.warn('openExternal: tauri-plugin-opener failed, falling back to window.open', error);
    }
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function handleExternalLinkClick(
  event: MouseEvent<HTMLAnchorElement>,
  url: string | undefined | null,
): void {
  if (!url) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1) return;
  event.preventDefault();
  void openExternal(url);
}
