// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { viewFor } from '@deal-city/engine';
import { AnchorProvider } from '../src/motion/anchor-context';
import { AnchorRegistry } from '../src/motion/anchors';
import { fanLayout } from '../src/scene/geometry';
import { CenterPiles } from '../src/tabletop/CenterPiles';
import { HandFan } from '../src/tabletop/HandFan';
import { Seat } from '../src/tabletop/Seat';
import { Tableau } from '../src/tabletop/Tableau';
import './dom';
import { play } from './fixtures';

function boxed(left: number, top: number): HTMLElement {
  const el = document.createElement('div');
  el.getBoundingClientRect = () => ({ left, top, width: 100, height: 140, right: left + 100, bottom: top + 140, x: left, y: top, toJSON: () => ({}) });
  return el;
}

function withAnchors(ui: ReactElement): AnchorRegistry {
  const registry = new AnchorRegistry();
  render(<AnchorProvider value={registry}>{ui}</AnchorProvider>);
  return registry;
}

describe('AnchorRegistry', () => {
  it('measures what is on the page and keeps the last pose of what left it', () => {
    const registry = new AnchorRegistry();
    const card = boxed(10, 20);
    registry.set('card:a', card);
    expect(registry.snapshot().get('card:a')).toMatchObject({ cx: 60, cy: 90, width: 100, height: 140 });
    registry.unset('card:a', card);
    expect(registry.measure(['card:a'])).toBeNull();
    expect(registry.snapshot().get('card:a')).toMatchObject({ cx: 60, cy: 90 });
    expect(registry.last('card:a')).toBe(card);
  });

  it('lets the newest element hold a key until it leaves, then the one before it again', () => {
    const registry = new AnchorRegistry();
    const inHand = boxed(0, 0);
    const ghost = boxed(300, 300);
    registry.set('card:a', inHand);
    registry.set('card:a', ghost);
    expect(registry.element('card:a')).toBe(ghost);
    registry.unset('card:a', ghost);
    expect(registry.element('card:a')).toBe(inHand);
  });

  it('measures the first key of a list that is on the page', () => {
    const registry = new AnchorRegistry();
    registry.set('bank:p1', boxed(200, 0));
    expect(registry.measure(['card:x', 'bank:p1'])).toMatchObject({ cx: 250 });
  });

  it('lists the mounted keys with a prefix', () => {
    const registry = new AnchorRegistry();
    registry.set('card:a', boxed(0, 0));
    registry.set('deck', boxed(0, 0));
    expect(registry.entries('card:').map(([key]) => key)).toEqual(['card:a']);
  });
});

describe('anchors on the table', () => {
  const state = () =>
    play({
      players: [
        { id: 'p1', hand: ['money-1-1', 'prop-red-1', 'money-2-1'], bank: ['money-5-1'], groups: [{ color: 'green', cards: ['prop-green-1'] }] },
        { id: 'p2', hand: ['money-3-1'] },
      ],
      discard: ['money-1-2'],
    });

  it('registers every card, hand, bank, group, area, seat and pile', () => {
    const view = viewFor(state(), 'p1');
    const registry = withAnchors(
      <>
        <HandFan cards={view.hand} me="p1" />
        <Tableau player={view.players[0]!} name="Ann" isMe at={{ x: 50, y: 80 }} />
        <CenterPiles view={view} activeAngle={270} />
        <Seat playerId="p2" name="Bob" avatar={1} anchor="seat:p2" isMe={false} active={false} connected handCount={1} playsLeft={null} />
      </>,
    );
    const keys = [
      'card:money-1-1', 'card:prop-red-1', 'hand:p1', 'card:money-5-1', 'bank:p1', 'card:prop-green-1', 'group:g1',
      'tableau:p1', 'center', 'deck', 'discard', 'card:money-1-2', 'seat:p2', 'hand:p2',
    ];
    for (const key of keys) expect(registry.element(key), key).not.toBeNull();
    expect(registry.element('card:money-5-1')).toBe(screen.getByRole('button', { name: /^5M money/ }));
  });

  it('tells flights how each hand card is turned', () => {
    const view = viewFor(state(), 'p1');
    withAnchors(<HandFan cards={view.hand} me="p1" />);
    expect(screen.getByRole('button', { name: /^1M money/ })).toHaveAttribute('data-rot', String(fanLayout(3, 0).rotate));
  });
});
