import { render, screen } from '@testing-library/react';
import About from '@/components/About';
import { describe, expect, it } from 'vitest';

describe('About page', () => {
  it('renders feedback / website / guide sections (EN)', () => {
    render(<About systemLanguage="English" />);
    expect(screen.getByRole('heading', { name: /Feedback & issues/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Official website/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /How to use/i })).toBeInTheDocument();
  });

  it('does not show "Release notes" wording', () => {
    render(<About systemLanguage="English" />);
    expect(screen.queryByText(/release notes/i)).toBeNull();
  });

  it('shows AGPL license, not MIT', () => {
    render(<About systemLanguage="English" />);
    expect(screen.getByText(/AGPL-3\.0-or-later/i)).toBeInTheDocument();
    expect(screen.queryByText(/^MIT$/)).toBeNull();
  });

  it('feedback link has correct href', () => {
    render(<About systemLanguage="English" />);
    const link = screen.getByRole('link', { name: /Report an issue on GitHub/i });
    expect(link.getAttribute('href')).toMatch(/github\.com\/.+\/issues/);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toMatch(/noreferrer/);
  });

  it('renders ZH section titles', () => {
    render(<About systemLanguage="Chinese" />);
    expect(screen.getByRole('heading', { name: /反馈与问题/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /使用说明/ })).toBeInTheDocument();
  });
});
