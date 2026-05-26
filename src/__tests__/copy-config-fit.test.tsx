import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Settings from '@/components/shared/Settings';
import { DEFAULT_SETTINGS } from '@/types';

describe('Settings - Copy Config module headings', () => {
  it('each module button root uses compact responsive text instead of fixed text-sm', () => {
    render(<Settings settings={DEFAULT_SETTINGS} onSave={vi.fn()} />);

    const env = screen.getByRole('button', { name: /ENVIRONMENT/i });
    expect(env.className).not.toMatch(/\btext-sm\b/);
    expect(env.className).toMatch(/text-\[10px\]/);
    expect(env.className).toContain('sm:text-[11px]');
    expect(env.className).toMatch(/\b2xl:text-xs\b/);
  });

  it('uses wider intermediate columns and only switches to six columns on very wide screens', () => {
    render(<Settings settings={DEFAULT_SETTINGS} onSave={vi.fn()} />);

    const env = screen.getByRole('button', { name: /ENVIRONMENT/i });
    const grid = env.parentElement!;
    expect(grid.className).toMatch(/\bgrid-cols-2\b/);
    expect(grid.className).toMatch(/\bsm:grid-cols-3\b/);
    expect(grid.className).not.toMatch(/\blg:grid-cols-6\b/);
    expect(grid.className).toMatch(/\b2xl:grid-cols-6\b/);
  });

  it('allows long module labels to wrap instead of clipping', () => {
    render(<Settings settings={DEFAULT_SETTINGS} onSave={vi.fn()} />);

    const env = screen.getByRole('button', { name: /ENVIRONMENT/i });
    expect(env.className).toMatch(/\bwhitespace-normal\b/);
    expect(env.className).toMatch(/\bbreak-words\b/);
    expect(env.className).toMatch(/\[overflow-wrap:anywhere\]/);
    expect(env.className).toMatch(/\bmin-h-12\b/);
  });

  it('keeps the same compact fit rules in Chinese system language', () => {
    render(
      <Settings
        settings={{ ...DEFAULT_SETTINGS, systemLanguage: 'Chinese' }}
        onSave={vi.fn()}
      />
    );

    const env = screen.getByRole('button', { name: '环境' });
    expect(env.className).toMatch(/text-\[10px\]/);
    expect(env.className).toMatch(/\bwhitespace-normal\b/);
    expect(env.className).toMatch(/\[overflow-wrap:anywhere\]/);
  });
});
