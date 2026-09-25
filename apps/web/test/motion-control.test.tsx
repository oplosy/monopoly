// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MotionControl } from '../src/motion/MotionControl';
import { MOTION_KEY, reloadMotion } from '../src/motion/setting';
import { renderTabletop } from './dom';
import { atTable, play } from './fixtures';

afterEach(() => {
  localStorage.clear();
  reloadMotion();
});

describe('the Animations switch', () => {
  it('is on by default, and switching it off is remembered and reaches the stylesheets', () => {
    render(<MotionControl />);
    const toggle = screen.getByRole('button', { name: 'Animations' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(localStorage.getItem(MOTION_KEY)).toBe('off');
    expect(document.documentElement.dataset.motion).toBe('off');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });

  it('sits in the game menu, next to Sound', () => {
    renderTabletop({ state: atTable(play({ players: [{ id: 'p1', hand: ['money-1-1'] }, { id: 'p2' }] }), 'p1') });
    const menu = screen.getByRole('navigation', { name: 'Game menu' });
    fireEvent.click(within(menu).getByRole('button', { name: 'Settings' }));
    const names = within(menu).getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent);
    expect(names.indexOf('Animations')).toBe(names.indexOf('Sound') + 1);
  });
});
