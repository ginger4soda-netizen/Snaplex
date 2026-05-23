import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(process.cwd(), 'extension');

describe('extension popup.html', () => {
  it('uses srcset with 2x and 3x logo variants', async () => {
    const html = await readFile(resolve(root, 'popup.html'), 'utf8');
    expect(html).toMatch(/icons\/popup-logo@2x\.png\s+2x/);
    expect(html).toMatch(/icons\/popup-logo@3x\.png\s+3x/);
  });
});
