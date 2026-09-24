import { describe, expect, it } from 'vitest';
import { applyIntent } from '../src/apply';
import type { Intent } from '../src/types';
import { makeState } from './helpers';

const two = () => makeState({ players: [{ id: 'a', hand: ['money-1-1'] }, { id: 'b' }] });

describe('applyIntent input hardening', () => {
  it.each(['constructor', 'valueOf', 'toString', 'hasOwnProperty', '__proto__'])('rejects "%s" as an intent type', (type) => {
    const s = two();
    expect(applyIntent(s, 'a', { type } as unknown as Intent)).toEqual({ ok: false, error: 'unknownIntent' });
  });

  it('treats a rent intent without doubles as playing none', () => {
    const s = makeState({ players: [{ id: 'a', hand: ['rent-red-yellow-1'], groups: [{ color: 'red', cards: ['prop-red-1'] }] }, { id: 'b', bank: ['money-2-1'] }] });
    const intent = { type: 'playRent', card: 'rent-red-yellow-1', color: 'red' } as unknown as Intent;
    expect(applyIntent(s, 'a', intent).ok).toBe(true);
  });

  it('reports unknown card ids on action plays as unknownCard', () => {
    const s = two();
    expect(applyIntent(s, 'a', { type: 'playDebtCollector', card: 'no-such-card', target: 'b' })).toEqual({ ok: false, error: 'unknownCard' });
    expect(applyIntent(s, 'a', { type: 'playBirthday', card: 'no-such-card' })).toEqual({ ok: false, error: 'unknownCard' });
  });
});
