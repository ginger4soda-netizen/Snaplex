import { invoke } from '@tauri-apps/api/core';

/**
 * Convert an image URL (asset://, file://, or http://) to a base64 data URL.
 * Falls back to Tauri IPC if fetch fails (common with asset:// URLs).
 */
export async function imageUrlToBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (fetchErr) {
    console.warn('imageUrlToBase64: fetch failed, will need imageId fallback:', fetchErr);
    throw fetchErr;
  }
}

/**
 * Read image as base64 via Tauri IPC — most reliable for desktop.
 * Bypasses asset:// protocol entirely by reading the file on the Rust side.
 */
export async function imageBase64FromId(imageId: string): Promise<string> {
  return invoke<string>('read_image_base64', { id: imageId });
}

/**
 * Get base64 for an image, trying IPC first (reliable), falling back to fetch.
 */
export async function getImageBase64(imageId: string, assetUrl: string): Promise<string> {
  try {
    return await imageBase64FromId(imageId);
  } catch {
    // IPC failed (maybe not in Tauri), try fetch
    return imageUrlToBase64(assetUrl);
  }
}
