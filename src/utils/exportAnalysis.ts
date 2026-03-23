import { AnalysisResult } from '@/types';
import { save as saveDialog } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';

interface ExportItem {
  filename: string;
  analysis: AnalysisResult | null;
  memo?: string;
}

export async function exportAnalysisData(items: ExportItem[]): Promise<void> {
  const path = await saveDialog({
    filters: [
      { name: 'JSON', extensions: ['json'] },
      { name: 'CSV', extensions: ['csv'] },
    ],
  });

  if (!path) return; // User cancelled

  let content: string;

  if (path.endsWith('.csv')) {
    const header = 'filename,subject,environment,composition,lighting,mood,style,memo';
    const rows = items.map(item => {
      const p = item.analysis?.structuredPrompts;
      return [
        csvEscape(item.filename),
        csvEscape(p?.subject?.original || ''),
        csvEscape(p?.environment?.original || ''),
        csvEscape(p?.composition?.original || ''),
        csvEscape(p?.lighting?.original || ''),
        csvEscape(p?.mood?.original || ''),
        csvEscape(p?.style?.original || ''),
        csvEscape(item.memo || ''),
      ].join(',');
    });
    content = [header, ...rows].join('\n');
  } else {
    const data = {
      exportedAt: new Date().toISOString(),
      images: items.map(item => ({
        filename: item.filename,
        analysis: item.analysis?.structuredPrompts || null,
        description: item.analysis?.description || null,
        memo: item.memo || null,
      })),
    };
    content = JSON.stringify(data, null, 2);
  }

  await invoke('write_text_file', { path, content });
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
