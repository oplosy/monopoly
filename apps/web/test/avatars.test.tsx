// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AVATAR_COUNT } from '@deal-city/protocol/constants';
import { describe, expect, it, vi } from 'vitest';
import { Avatar, characterOf } from '../src/avatars/Avatar';
import { AvatarPicker } from '../src/avatars/AvatarPicker';
import { CHARACTERS } from '../src/avatars/characters';
import './dom';
import { roomOf } from './fixtures';

describe('characters', () => {
  it('has twelve characters with distinct names and backgrounds', () => {
    expect(CHARACTERS).toHaveLength(AVATAR_COUNT);
    expect(new Set(CHARACTERS.map((c) => c.name)).size).toBe(AVATAR_COUNT);
    expect(new Set(CHARACTERS.map((c) => c.bg.toLowerCase())).size).toBe(AVATAR_COUNT);
    expect(CHARACTERS.slice(0, 3).map((c) => c.name)).toEqual(['Fox', 'Bear', 'Cat']);
  });

  it('wraps out-of-range indices', () => {
    expect(characterOf(12)).toBe(CHARACTERS[0]);
    expect(characterOf(-1)).toBe(CHARACTERS[11]);
  });

  it('is decorative unless it has a label', () => {
    const { container } = render(
      <>
        <Avatar index={3} />
        <Avatar index={4} label="Your character: Owl" />
      </>,
    );
    expect(container.querySelectorAll('svg')[0]).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('img', { name: 'Your character: Owl' })).toBeInTheDocument();
  });

  it('draws every character', () => {
    const { container } = render(
      <>
        {CHARACTERS.map((c, i) => (
          <Avatar key={c.name} index={i} />
        ))}
      </>,
    );
    for (const svg of container.querySelectorAll('svg')) expect(svg.querySelectorAll('circle, ellipse, path').length).toBeGreaterThan(3);
  });
});

describe('AvatarPicker', () => {
  it('marks my character, blocks taken ones and picks free ones', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<AvatarPicker seats={roomOf(['p1', 'p2'], 'lobby').seats} me="p1" onPick={onPick} />);
    const picker = screen.getByRole('group', { name: 'Your character' });
    expect(within(picker).getAllByRole('button')).toHaveLength(AVATAR_COUNT);
    expect(within(picker).getByRole('button', { name: 'Fox' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(picker).getByRole('button', { name: 'Bear, taken by Bob' })).toBeDisabled();
    await user.click(within(picker).getByRole('button', { name: 'Frog' }));
    await user.click(within(picker).getByRole('button', { name: 'Fox' }));
    expect(onPick.mock.calls).toEqual([[3]]);
  });
});
