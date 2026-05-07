import { describe, expect, it } from 'vitest';
import { parseExportedFile } from './importHistory';

const imageDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

function fileFromHtml(html: string) {
  return new File([html], 'legacy.xls', { type: 'application/vnd.ms-excel' });
}

describe('parseExportedFile', () => {
  it('parses legacy multi-row image exports grouped by image cell', async () => {
    const html = `
      <table>
        <tr><th>Image</th><th>Front Prompt</th><th>Back Prompt</th></tr>
        <tr>
          <td rowspan="6"><img src="${imageDataUrl}"></td>
          <td>[SUBJECT] a red chair</td>
          <td>[SUBJECT] 一把红色椅子</td>
        </tr>
        <tr><td>[ENVIRONMENT] studio</td><td>[ENVIRONMENT] 工作室</td></tr>
        <tr><td>[COMPOSITION] centered</td><td>[COMPOSITION] 居中</td></tr>
        <tr><td>[LIGHTING] softbox</td><td>[LIGHTING] 柔光箱</td></tr>
        <tr><td>[MOOD] calm</td><td>[MOOD] 平静</td></tr>
        <tr><td>[STYLE] editorial</td><td>[STYLE] 编辑风</td></tr>
      </table>
    `;

    const items = await parseExportedFile(fileFromHtml(html));

    expect(items).toHaveLength(1);
    expect(items[0].imageUrl).toBe(imageDataUrl);
    expect(items[0].analysis.structuredPrompts.subject.original).toBe('a red chair');
    expect(items[0].analysis.structuredPrompts.subject.translated).toBe('一把红色椅子');
    expect(items[0].analysis.structuredPrompts.style.original).toBe('editorial');
    expect(items[0].analysis.structuredPrompts.style.translated).toBe('编辑风');
  });

  it('keeps single-row exports with colon labels working', async () => {
    const html = `
      <table><tbody>
        <tr>
          <td><img src="${imageDataUrl}"></td>
          <td>[SUBJECT]: glass vase<br>[STYLE]: product photo</td>
          <td>[SUBJECT]: 玻璃花瓶<br>[STYLE]: 产品摄影</td>
        </tr>
      </tbody></table>
    `;

    const items = await parseExportedFile(fileFromHtml(html));

    expect(items).toHaveLength(1);
    expect(items[0].analysis.structuredPrompts.subject.original).toBe('glass vase');
    expect(items[0].analysis.structuredPrompts.style.translated).toBe('产品摄影');
  });
});
