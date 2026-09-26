// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ChatThread } from '../src/chat/ChatThread';
import './dom';

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

  it('caps the box at 200 characters', () => {
    render(<ChatThread messages={[]} me="p1" onSend={vi.fn()} />);
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveAttribute('maxlength', '200');
  });
});
