// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { viewFor } from '@deal-city/engine';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CardFace } from '../src/cards/CardFace';
import { Tableau } from '../src/tabletop/Tableau';
import './dom';
import { play } from './fixtures';
import { stubAnimations } from './motion';

vi.mock('../src/cards/CardFace', () => ({ CardFace: vi.fn(() => null) }));

afterEach(() => vi.restoreAllMocks());

describe('counters', () => {
  it('count a bank total up without redrawing the bank cards on every frame', () => {
    const animations = stubAnimations();
    try {
      const frames: FrameRequestCallback[] = [];
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => frames.push(cb));
      vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
      const me = (bank: string[]) => viewFor(play({ players: [{ id: 'p1', bank }, { id: 'p2' }] }), 'p1').players[0]!;
      const { rerender } = render(<Tableau player={me(['money-1-1'])} name="Ann" isMe at={{ x: 50, y: 80 }} />);
      rerender(<Tableau player={me(['money-1-1', 'money-5-1'])} name="Ann" isMe at={{ x: 50, y: 80 }} />);
      const drawn = vi.mocked(CardFace).mock.calls.length;
      const t0 = performance.now();
      for (const step of [100, 200, 400]) {
        act(() => frames.shift()?.(t0 + step));
      }
      expect(document.querySelector('.bank-total')).toHaveTextContent('6M');
      expect(screen.getByRole('group', { name: 'Your bank, 6M' })).toBeInTheDocument();
      expect(vi.mocked(CardFace).mock.calls.length).toBe(drawn);
    } finally {
      animations.restore();
    }
  });
});
