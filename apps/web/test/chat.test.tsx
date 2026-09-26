// @vitest-environment jsdom
import { act, render, renderHook, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ChatButton } from '../src/chat/ChatButton';
import { ChatSheet } from '../src/chat/ChatSheet';
import { CHAT_BUBBLE_MS, useChatBubbles } from '../src/chat/bubbles';
import { ChatThread } from '../src/chat/ChatThread';
import { renderTabletop } from './dom';
import { atTable, play } from './fixtures';

const m = (id: number, from: string, name: string, text: string) => ({ id, from, name, text, at: id });

describe('ChatThread', () => {
  it('lists each line with its sender, as plain text', () => {
    render(<ChatThread messages={[m(1, 'p2', 'Bob', '<b>hi</b>'), m(2, 'p1', 'Ann', 'hey')]} me="p1" onSend={vi.fn()} />);
    const items = within(screen.getByRole('list', { name: 'Messages' })).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual(['Bob: <b>hi</b>', 'Ann: hey']);
    expect(items[0]!.querySelector('b')).toBeNull();
    expect(items[1]).toHaveClass('is-mine');
  });

  it('sends with Enter, once, and clears the box only when the server accepts', async () => {
    let settle: (v: { ok: true }) => void = () => {};
    const onSend = vi.fn(() => new Promise<{ ok: true }>((r) => (settle = r)));
    const user = userEvent.setup();
    render(<ChatThread messages={[]} me="p1" onSend={onSend} />);
    const box = screen.getByRole('textbox', { name: 'Message' });
    await user.type(box, 'gg{Enter}{Enter}');
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith('gg');
    expect(box).toHaveValue('gg');
    settle({ ok: true });
    await vi.waitFor(() => expect(box).toHaveValue(''));
  });

  it('keeps the text when sending fails, and never sends blanks', async () => {
    const onSend = vi.fn(async () => ({ ok: false as const, error: 'offline' }));
    const user = userEvent.setup();
    render(<ChatThread messages={[]} me="p1" onSend={onSend} />);
    const box = screen.getByRole('textbox', { name: 'Message' });
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    await user.type(box, '   {Enter}');
    expect(onSend).not.toHaveBeenCalled();
    await user.clear(box);
    await user.type(box, 'still here{Enter}');
    await vi.waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
    expect(box).toHaveValue('still here');
  });

  it('keeps what was typed while a line was on its way', async () => {
    let settle: (v: { ok: true }) => void = () => {};
    const onSend = vi.fn(() => new Promise<{ ok: true }>((r) => (settle = r)));
    const user = userEvent.setup();
    render(<ChatThread messages={[]} me="p1" onSend={onSend} />);
    const box = screen.getByRole('textbox', { name: 'Message' });
    await user.type(box, 'hi{Enter}');
    await user.type(box, ' there');
    settle({ ok: true });
    await vi.waitFor(() => expect(box).toHaveValue(' there'));
  });

  it('caps the box at 200 characters', () => {
    render(<ChatThread messages={[]} me="p1" onSend={vi.fn()} />);
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveAttribute('maxlength', '200');
  });
});

describe('ChatButton', () => {
  it('names its unread count and shows it as a badge', () => {
    const { rerender } = render(<ChatButton unread={0} open={false} onToggle={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Chat' })).toHaveAttribute('aria-expanded', 'false');
    rerender(<ChatButton unread={3} open={false} onToggle={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Chat, 3 unread' })).toHaveTextContent('3');
  });
});

describe('useChatBubbles', () => {
  it('shows another player’s new line at their seat for 3 s, only while the sheet is closed', () => {
    vi.useFakeTimers();
    try {
      const history = [m(1, 'p2', 'Bob', 'old')];
      const { result, rerender } = renderHook(({ msgs, open }) => useChatBubbles(msgs, 'p1', open), {
        initialProps: { msgs: history, open: false },
      });
      // Lines already there when the table opens are history: no bubble.
      expect(result.current).toEqual({});
      rerender({ msgs: [...history, m(2, 'p2', 'Bob', 'hi'), m(3, 'p1', 'Ann', 'mine')], open: false });
      expect(result.current).toEqual({ p2: 'hi' });
      act(() => void vi.advanceTimersByTime(CHAT_BUBBLE_MS));
      expect(result.current).toEqual({});
      rerender({ msgs: [...history, m(2, 'p2', 'Bob', 'hi'), m(3, 'p1', 'Ann', 'mine'), m(4, 'p2', 'Bob', 'seen')], open: true });
      expect(result.current).toEqual({});
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('chat at the table', () => {
  it('opens the sheet from the corner button, reads the lines, and closes on Escape', async () => {
    const user = userEvent.setup();
    const { store, socket } = renderTabletop({ state: atTable(play({ players: [{ id: 'p1' }, { id: 'p2' }] }), 'p1') });
    act(() => socket.push('chat:message', m(1, 'p2', 'Bob', 'hi')));
    expect(store.getState().chatUnread).toBe(1);
    // The bubble at Bob's seat, while the sheet is closed.
    expect(within(screen.getByRole('group', { name: /^Bob's seat/ })).getByText('hi')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Chat, 1 unread' }));
    const sheet = screen.getByRole('complementary', { name: 'Chat' });
    expect(within(sheet).getByRole('list', { name: 'Messages' })).toHaveTextContent('Bob: hi');
    expect(store.getState().chatUnread).toBe(0);
    expect(within(sheet).getByRole('textbox', { name: 'Message' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('complementary', { name: 'Chat' })).not.toBeInTheDocument();
  });
});

describe('ChatSheet', () => {
  it('keeps marking lines read once the chat is full at 50 lines', () => {
    const lines = (from: number) => Array.from({ length: 50 }, (_, i) => m(from + i, 'p2', 'Bob', `line ${from + i}`));
    const onRead = vi.fn();
    const props = { me: 'p1', onSend: vi.fn(), onRead, onClose: vi.fn() };
    const { rerender } = render(<ChatSheet messages={lines(1)} {...props} />);
    onRead.mockClear();
    // The 51st line: the store drops the oldest, so the list is still 50 long.
    rerender(<ChatSheet messages={lines(2)} {...props} />);
    expect(onRead).toHaveBeenCalledTimes(1);
  });
});
