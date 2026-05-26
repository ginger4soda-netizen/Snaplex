import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get, set } from 'idb-keyval';
import ChatBot from '@/components/shared/ChatBot';

vi.mock('idb-keyval', () => ({
  get: vi.fn(),
  set: vi.fn(),
}));

vi.mock('@/services/geminiService', () => ({
  sendChatMessageStream: vi.fn(),
}));

const savedChips = [
  { id: 'first', label: 'First', prompt: 'first prompt', isDefault: false },
  { id: 'second', label: 'Second', prompt: 'second prompt', isDefault: false },
  { id: 'third', label: 'Third', prompt: 'third prompt', isDefault: false },
];

const renderChatBot = () => {
  const onUpdateMessages = vi.fn();
  const view = render(
    <ChatBot
      messages={[{ id: 'existing', role: 'model', text: 'Ready', timestamp: 1 }]}
      onUpdateMessages={onUpdateMessages}
      systemLanguage="English"
    />
  );
  return { ...view, onUpdateMessages };
};

describe('ChatBot chip reordering', () => {
  beforeEach(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
    vi.mocked(get).mockResolvedValue(savedChips);
    vi.mocked(set).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('reorders chips with pointer drag and persists the new order', async () => {
    renderChatBot();

    await screen.findByRole('button', { name: 'First' });
    const firstChip = screen.getByRole('button', { name: 'First' }).closest('[data-snaplex-chip-id]') as HTMLElement;
    const secondChip = screen.getByRole('button', { name: 'Second' }).closest('[data-snaplex-chip-id]') as HTMLElement;

    Object.defineProperty(document, 'elementsFromPoint', {
      configurable: true,
      value: vi.fn(() => [secondChip]),
    });

    fireEvent.pointerDown(firstChip, { pointerId: 1, clientX: 0, clientY: 0, button: 0 });
    fireEvent.pointerMove(firstChip, { pointerId: 1, clientX: 24, clientY: 0, button: 0 });
    fireEvent.pointerUp(firstChip, { pointerId: 1, clientX: 24, clientY: 0, button: 0 });

    await waitFor(() => {
      expect(screen.getAllByTestId('chat-chip').map(chip => chip.dataset.snaplexChipId)).toEqual([
        'second',
        'first',
        'third',
      ]);
    });

    expect(set).toHaveBeenCalledWith('snaplex_all_chips', [
      savedChips[1],
      savedChips[0],
      savedChips[2],
    ]);
  });

  it('does not expose native draggable chips that can bubble into file drop handling', async () => {
    const outerMove = vi.fn();
    render(
      <div onPointerMove={outerMove}>
        <ChatBot
          messages={[{ id: 'existing', role: 'model', text: 'Ready', timestamp: 1 }]}
          onUpdateMessages={vi.fn()}
          systemLanguage="English"
        />
      </div>
    );

    await screen.findByRole('button', { name: 'First' });
    const firstChip = screen.getByRole('button', { name: 'First' }).closest('[data-snaplex-chip-id]') as HTMLElement;

    expect(firstChip).not.toHaveAttribute('draggable');

    fireEvent.pointerDown(firstChip, { pointerId: 1, clientX: 0, clientY: 0, button: 0 });
    fireEvent.pointerMove(firstChip, { pointerId: 1, clientX: 24, clientY: 0, button: 0 });

    expect(outerMove).not.toHaveBeenCalled();
  });

  it('keeps delete button clicks scoped to deletion', async () => {
    renderChatBot();

    const firstButton = await screen.findByRole('button', { name: 'First' });
    vi.useFakeTimers();
    fireEvent.mouseDown(firstButton, { clientX: 0, clientY: 0 });
    act(() => {
      vi.advanceTimersByTime(800);
    });
    fireEvent.mouseUp(firstButton);

    fireEvent.click(screen.getAllByRole('button', { name: '−' })[0]);
    vi.useRealTimers();

    await waitFor(() => {
      expect(screen.getAllByTestId('chat-chip').map(chip => chip.dataset.snaplexChipId)).toEqual([
        'second',
        'third',
      ]);
    });

    expect(set).toHaveBeenLastCalledWith('snaplex_all_chips', [savedChips[1], savedChips[2]]);
  });

  it('still reorders chips while delete mode is active', async () => {
    renderChatBot();

    const firstButton = await screen.findByRole('button', { name: 'First' });
    vi.useFakeTimers();
    fireEvent.mouseDown(firstButton, { clientX: 0, clientY: 0 });
    act(() => {
      vi.advanceTimersByTime(800);
    });
    fireEvent.mouseUp(firstButton);
    vi.useRealTimers();

    expect(screen.getAllByRole('button', { name: '−' })).toHaveLength(3);

    const firstChip = screen.getByRole('button', { name: 'First' }).closest('[data-snaplex-chip-id]') as HTMLElement;
    const thirdChip = screen.getByRole('button', { name: 'Third' }).closest('[data-snaplex-chip-id]') as HTMLElement;
    Object.defineProperty(document, 'elementsFromPoint', {
      configurable: true,
      value: vi.fn(() => [thirdChip]),
    });

    fireEvent.pointerDown(firstChip, { pointerId: 2, clientX: 0, clientY: 0, button: 0 });
    fireEvent.pointerMove(firstChip, { pointerId: 2, clientX: 30, clientY: 0, button: 0 });
    fireEvent.pointerUp(firstChip, { pointerId: 2, clientX: 30, clientY: 0, button: 0 });

    await waitFor(() => {
      expect(screen.getAllByTestId('chat-chip').map(chip => chip.dataset.snaplexChipId)).toEqual([
        'second',
        'third',
        'first',
      ]);
    });

    expect(set).toHaveBeenLastCalledWith('snaplex_all_chips', [
      savedChips[1],
      savedChips[2],
      savedChips[0],
    ]);
  });
});
