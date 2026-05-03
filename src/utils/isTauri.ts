// Detect Tauri runtime. Tauri v2 exposes `__TAURI_INTERNALS__`; the legacy
// `__TAURI__` global only appears on v1 (or when explicitly opted into on v2).
// Checking both keeps detection robust across versions.
export function isTauri(): boolean {
  if (typeof window === 'undefined') return false;
  return '__TAURI_INTERNALS__' in window || '__TAURI__' in window;
}
