import { describe, it, expect } from 'vitest';
import { safeParseJSON } from './jsonParser';

describe('safeParseJSON', () => {
  it('should parse valid JSON', () => {
    const result = safeParseJSON('{"key": "value"}', {});
    expect(result).toEqual({ key: 'value' });
  });

  it('should return fallback for empty string', () => {
    const fallback = { default: true };
    expect(safeParseJSON('', fallback)).toBe(fallback);
  });

  it('should extract JSON from mixed content (LLM thinking prefix)', () => {
    const input = '这是模型的思考过程...\n{"original": "hello", "translated": "你好"}';
    const result = safeParseJSON(input, { original: '', translated: '' });
    expect(result).toEqual({ original: 'hello', translated: '你好' });
  });

  it('should extract JSON from markdown code blocks', () => {
    const input = '```json\n{"key": "value"}\n```';
    const result = safeParseJSON(input, {});
    expect(result).toEqual({ key: 'value' });
  });

  it('should handle control characters in JSON', () => {
    const input = '{"text": "line1\nline2"}';
    const result = safeParseJSON(input, { text: '' });
    expect(result.text).toContain('line1');
    expect(result.text).toContain('line2');
  });

  it('should handle trailing commas', () => {
    const input = '{"a": 1, "b": 2,}';
    const result = safeParseJSON(input, {});
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it('should return fallback when all parsing fails', () => {
    const fallback = { safe: true };
    const result = safeParseJSON('completely invalid garbage!!!', fallback);
    expect(result).toBe(fallback);
  });

  it('should parse JSON arrays', () => {
    const input = 'some text [1, 2, 3] more text';
    const result = safeParseJSON(input, []);
    expect(result).toEqual([1, 2, 3]);
  });
});
