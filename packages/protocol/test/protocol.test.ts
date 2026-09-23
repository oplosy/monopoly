import { describe, expect, it } from 'vitest';
import { CreateRoomSchema, IntentPayloadSchema, IntentSchema, JoinRoomSchema, ResumeSchema, StartSchema } from '../src/index';

describe('IntentSchema', () => {
  it('accepts engine intent shapes', () => {
    const samples = [
      { type: 'playToBank', card: 'money-1-1' },
      { type: 'playProperty', card: 'prop-red-1', color: 'red' },
      { type: 'playRent', card: 'rent-any-1', color: 'red', target: 'p2', doubles: [] },
      { type: 'playRent', card: 'rent-red-yellow-1', color: 'red', doubles: ['act-doubleRent-1'] },
      { type: 'moveProperty', card: 'wild-any-1', toGroup: 'new', color: 'green' },
      { type: 'playDealBreaker', card: 'act-dealBreaker-1', targetGroup: 'g3' },
      { type: 'endTurn' },
      { type: 'discard', cards: ['money-1-1'] },
      { type: 'pay', cards: [] },
      { type: 'acceptAction' },
      { type: 'respondJustSayNo', card: 'act-justSayNo-1', targetPlayer: 'p2' },
    ];
    for (const s of samples) expect(IntentSchema.safeParse(s).success, JSON.stringify(s)).toBe(true);
  });

  it('rejects unknown types, bad colors, missing fields and non-objects', () => {
    expect(IntentSchema.safeParse({ type: 'valueOf' }).success).toBe(false);
    expect(IntentSchema.safeParse({ type: 'playProperty', card: 'prop-red-1', color: 'purple' }).success).toBe(false);
    expect(IntentSchema.safeParse({ type: 'playRent', card: 'rent-any-1', color: 'red' }).success).toBe(false);
    expect(IntentSchema.safeParse({ type: 'pay', cards: 'money-1-1' }).success).toBe(false);
    expect(IntentSchema.safeParse(null).success).toBe(false);
    expect(IntentSchema.safeParse('endTurn').success).toBe(false);
  });

  it('strips unknown keys', () => {
    const r = IntentSchema.safeParse({ type: 'endTurn', evil: true });
    expect(r.success && r.data).toEqual({ type: 'endTurn' });
  });

  it('bounds string and array sizes', () => {
    expect(IntentSchema.safeParse({ type: 'playToBank', card: 'x'.repeat(41) }).success).toBe(false);
    expect(IntentSchema.safeParse({ type: 'playRent', card: 'rent-any-1', color: 'red', doubles: ['a', 'b', 'c'] }).success).toBe(false);
  });
});

describe('payload schemas', () => {
  it('validates room codes, tokens, seeds, versions and nicknames', () => {
    expect(JoinRoomSchema.safeParse({ code: 'ABC234', nickname: 'Ann' }).success).toBe(true);
    expect(JoinRoomSchema.safeParse({ code: 'ABC-23', nickname: 'Ann' }).success).toBe(false);
    expect(ResumeSchema.safeParse({ token: 'a'.repeat(32) }).success).toBe(true);
    expect(ResumeSchema.safeParse({ token: 'xyz' }).success).toBe(false);
    expect(StartSchema.safeParse({}).success).toBe(true);
    expect(StartSchema.safeParse({ seed: -1 }).success).toBe(false);
    expect(IntentPayloadSchema.safeParse({ intent: { type: 'endTurn' }, expectedVersion: 3 }).success).toBe(true);
    expect(IntentPayloadSchema.safeParse({ intent: { type: 'endTurn' }, expectedVersion: -1 }).success).toBe(false);
    expect(CreateRoomSchema.safeParse({ nickname: 'x'.repeat(65) }).success).toBe(false);
  });
});
