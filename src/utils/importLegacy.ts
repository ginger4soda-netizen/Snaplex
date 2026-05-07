// ============================================
// Legacy Data Import - Adapts web-era XLS exports for Tauri SQLite
// ============================================
// Reuses the existing parseExportedFile logic from importHistory.ts,
// then bridges the HistoryItem[] into Tauri IPC calls for the new DB.

import { HistoryItem, AnalysisResult, ImportResult } from '../types';
import { parseExportedFile } from './importHistory';
import { isTauri } from './isTauri';

/**
 * Import a legacy .xls export file into the current library.
 *
 * In Tauri mode:
 *   1. Parse the file into HistoryItem[]
 *   2. For each item, save the base64 image as a file via IPC
 *   3. Save the analysis data via IPC
 *
 * In web mode:
 *   Falls back to returning parsed HistoryItem[] for idb-keyval storage.
 */
export async function importLegacyFile(file: File): Promise<{
  items: HistoryItem[];
  result: ImportResult;
}> {
  if (file.name.toLowerCase().endsWith('.xlsx')) {
    throw new Error('Binary .xlsx legacy imports are not supported yet. Please use the legacy Snaplex .xls HTML export format.');
  }

  const items = await parseExportedFile(file);
  if (items.length === 0) {
    throw new Error('No valid legacy Snaplex export rows found');
  }

  if (!isTauri()) {
    // Web fallback: return items for direct idb-keyval storage
    return {
      items,
      result: { imported: items.length, failed: 0, errors: [] },
    };
  }

  // Tauri mode: import via IPC
  let imported = 0;
  let failed = 0;
  const errors: string[] = [];

  try {
    const { invoke } = await import('@tauri-apps/api/core');

    for (const item of items) {
      try {
        // Save the base64 image to the library via a dedicated import command
        const imageId = await invoke('import_legacy_item', {
          base64Image: item.imageUrl,
          analysis: item.analysis,
          memo: item.memo || '',
          isFavorite: item.isFavorite || false,
          timestamp: item.timestamp,
        }) as string;

        imported++;
      } catch (e: any) {
        failed++;
        errors.push(`Item ${item.id}: ${e.message || String(e)}`);
      }
    }
  } catch (e: any) {
    // If Tauri invoke fails entirely, still return parsed items for fallback
    return {
      items,
      result: { imported: 0, failed: items.length, errors: [`Tauri IPC unavailable: ${e.message}`] },
    };
  }

  return {
    items: [], // In Tauri mode, items are in SQLite, not returned
    result: { imported, failed, errors },
  };
}

/**
 * Import images from file paths (Tauri desktop drag-and-drop or file picker).
 * This delegates to the Tauri backend which handles:
 *   - Copying files to the library's images/ directory
 *   - Generating thumbnails
 *   - Extracting CLIP vectors
 *   - Extracting color palettes
 */
export async function importImageFiles(
  filePaths: string[],
  folderId?: string
): Promise<ImportResult> {
  if (!isTauri()) {
    return { imported: 0, failed: filePaths.length, errors: ['File import requires desktop app'] };
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('import_images', { filePaths, folderId }) as ImportResult;
  } catch (e: any) {
    return { imported: 0, failed: filePaths.length, errors: [e.message || String(e)] };
  }
}
