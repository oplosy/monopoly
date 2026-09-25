import { describe, expect, it } from 'vitest';
import { viewFor } from '@deal-city/engine';
import { opponentsInOrder } from '../src/game/derive';
import { discardJitter, fanLayout, planePoint, SEAT_UI_RADIUS, seatLayout, seatPlan, WEDGE_CLEAR, wedgeReach } from '../src/scene/geometry';
import { play } from './fixtures';

describe('planePoint', () => {
  it('puts 270° nearest the viewer and 90° at the far side', () => {
    expect(planePoint(270, 1)).toEqual({ x: 50, y: 100 });
    expect(planePoint(90, 1)).toEqual({ x: 50, y: 0 });
    expect(planePoint(0, 0.5)).toEqual({ x: 75, y: 50 });
    expect(planePoint(180, 0.5)).toEqual({ x: 25, y: 50 });
  });
});

describe('seatLayout', () => {
  it('seats two players face to face and three at 120°', () => {
    expect(seatLayout(2).map((s) => s.angle)).toEqual([270, 90]);
    expect(seatLayout(3).map((s) => s.angle)).toEqual([270, 150, 30]);
    expect(seatLayout(1).map((s) => s.angle)).toEqual([270]);
  });

  it('puts the lobby chairs just outside the rim', () => {
    for (const spot of seatLayout(3)) expect(spot.ui).toEqual(planePoint(spot.angle, SEAT_UI_RADIUS));
    expect(seatLayout(3)[1]!.ui.x).toBeLessThan(50); // the first opponent sits upper left
    expect(seatLayout(3)[1]!.ui.y).toBeLessThan(50);
  });
});

describe('seatPlan', () => {
  it('puts me at 270° and the others in the order of opponentsInOrder', () => {
    const view = viewFor(play({ players: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }] }), 'p2');
    const plan = seatPlan(view.players.map((p) => p.id), view.me);
    expect(plan.map((p) => p.playerId)).toEqual(['p2', ...opponentsInOrder(view).map((p) => p.id)]);
    expect(plan.map((p) => p.spot.angle)).toEqual([270, 150, 30]);
  });

  it('can leave empty chairs for a three-seat lobby', () => {
    const plan = seatPlan(['p1', 'p2'], 'p1', 3);
    expect(plan.map((p) => [p.playerId, p.spot.angle])).toEqual([['p1', 270], ['p2', 150]]);
  });

  it('keeps seat order when the viewer is not seated', () => {
    expect(seatPlan(['p1', 'p2'], 'p9').map((p) => p.playerId)).toEqual(['p1', 'p2']);
  });
});

describe('discardJitter', () => {
  it('is fixed per card and stays in range', () => {
    const ids = Array.from({ length: 40 }, (_, i) => `money-1-${i}`);
    for (const id of ids) {
      const j = discardJitter(id);
      expect(discardJitter(id)).toEqual(j);
      expect(Math.abs(j.rotate)).toBeLessThanOrEqual(15);
      expect(Math.abs(j.dx)).toBeLessThanOrEqual(6);
      expect(Math.abs(j.dy)).toBeLessThanOrEqual(4);
    }
    expect(new Set(ids.map((id) => discardJitter(id).rotate)).size).toBeGreaterThan(5);
  });
});

describe('fanLayout', () => {
  it('fans symmetrically around the middle card', () => {
    const fan = Array.from({ length: 5 }, (_, i) => fanLayout(5, i));
    expect(fan[2]).toEqual({ rotate: 0, drop: 0 });
    expect(fan[0]!.rotate).toBe(-fan[4]!.rotate);
    expect(fan[0]!.drop).toBe(fan[4]!.drop);
    expect(fan.map((f) => f.rotate)).toEqual([...fan.map((f) => f.rotate)].sort((a, b) => a - b));
  });

  it('keeps a 15-card fan within 28°', () => {
    const fan = Array.from({ length: 15 }, (_, i) => fanLayout(15, i));
    expect(fan.at(-1)!.rotate - fan[0]!.rotate).toBeLessThanOrEqual(28);
  });

  it('does not tilt a single card', () => {
    expect(fanLayout(1, 0)).toEqual({ rotate: 0, drop: 0 });
  });
});

describe('wedgeReach', () => {
  // The deck and the discard pile, in card widths around the center (y up): side by side, 0.6 apart.
  const piles = [
    { x1: -1.3, x2: -0.3, y1: -0.7, y2: 0.7 },
    { x1: 0.3, x2: 1.3, y1: -0.7, y2: 0.7 },
  ];
  /** The wedge's box (0.6 × 0.45, turned to point at the seat) at `reach` toward `angle` overlaps a pile. */
  const overPile = (angle: number, reach: number, room = WEDGE_CLEAR) => {
    const a = (angle * Math.PI) / 180;
    const turn = ((90 - angle) * Math.PI) / 180;
    const hx = 0.3 * Math.abs(Math.cos(turn)) + 0.225 * Math.abs(Math.sin(turn));
    const hy = 0.3 * Math.abs(Math.sin(turn)) + 0.225 * Math.abs(Math.cos(turn));
    const cx = reach * Math.cos(a);
    const cy = reach * Math.sin(a);
    return piles.some(
      (p) => cx - hx < p.x2 + room - 1e-9 && cx + hx > p.x1 - room + 1e-9 && cy - hy < p.y2 + room - 1e-9 && cy + hy > p.y1 - room + 1e-9,
    );
  };

  it('keeps the wedge in the gap between the piles when it points straight up or down', () => {
    expect(wedgeReach(90)).toBe(0.72);
    expect(wedgeReach(270)).toBe(0.72);
    expect(overPile(270, 0.72, 0)).toBe(false);
  });

  it('takes the wedge past the piles toward any side seat, with room to spare, and no further than it must', () => {
    for (const angle of [30, 150, 210, 330, 0, 180]) {
      const reach = wedgeReach(angle);
      expect(overPile(angle, reach), `${angle}°`).toBe(false);
      expect(overPile(angle, reach - 0.02), `${angle}° a little closer`).toBe(true);
    }
    expect(wedgeReach(30)).toBe(wedgeReach(150));
  });
});
