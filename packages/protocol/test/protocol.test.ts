import { describe, expect, it } from 'vitest';
import { AVATAR_COUNT, AvatarSchema, CHAT_HISTORY, CHAT_MAX_LENGTH, ChatSendSchema, CreateRoomSchema, IntentPayloadSchema, IntentSchema, JoinRoomSchema, ResumeSchema, StartSchema, VoiceMicSchema, VoiceSignalSchema } from '../src/index';

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

describe('AvatarSchema', () => {
  it('accepts the 12 character indices only', () => {
    expect(AVATAR_COUNT).toBe(12);
    expect(AvatarSchema.safeParse({ avatar: 0 }).success).toBe(true);
    expect(AvatarSchema.safeParse({ avatar: 11 }).success).toBe(true);
    for (const avatar of [-1, 12, 1.5, '3', null]) expect(AvatarSchema.safeParse({ avatar }).success, String(avatar)).toBe(false);
    expect(AvatarSchema.safeParse({}).success).toBe(false);
  });
});

describe('ChatSendSchema', () => {
  it('takes one text field and strips the rest', () => {
    const r = ChatSendSchema.safeParse({ text: 'hello', evil: 1 });
    expect(r.success && r.data).toEqual({ text: 'hello' });
  });

  it('refuses a missing or non-string text, and anything far past the limit before the server trims it', () => {
    expect(ChatSendSchema.safeParse({}).success).toBe(false);
    expect(ChatSendSchema.safeParse({ text: 5 }).success).toBe(false);
    expect(ChatSendSchema.safeParse({ text: 'x'.repeat(4 * CHAT_MAX_LENGTH + 1) }).success).toBe(false);
    expect(ChatSendSchema.safeParse({ text: ' '.repeat(CHAT_MAX_LENGTH) + 'x' }).success).toBe(true);
  });

  it('keeps 50 messages of up to 200 characters', () => {
    expect([CHAT_MAX_LENGTH, CHAT_HISTORY]).toEqual([200, 50]);
  });
});

describe('voice schemas', () => {
  it('takes a mic switch', () => {
    expect(VoiceMicSchema.safeParse({ on: true }).success).toBe(true);
    expect(VoiceMicSchema.safeParse({ on: 'yes' }).success).toBe(false);
  });

  it('takes a description or a candidate for another player, and nothing else', () => {
    const offer = { to: 'p2', data: { description: { type: 'offer', sdp: 'v=0' } } };
    const ice = { to: 'p2', data: { candidate: { candidate: 'candidate:1 1 udp 1 1.2.3.4 5 typ host', sdpMid: '0', sdpMLineIndex: 0 } } };
    const end = { to: 'p2', data: { candidate: null } };
    const reset = { to: 'p2', data: { reset: true } };
    for (const ok of [offer, ice, end, reset]) expect(VoiceSignalSchema.safeParse(ok).success).toBe(true);
    expect(VoiceSignalSchema.safeParse({ to: 'p2', data: { description: { type: 'hello' } } }).success).toBe(false);
    expect(VoiceSignalSchema.safeParse({ to: 'p2', data: {} }).success).toBe(false);
    expect(VoiceSignalSchema.safeParse({ to: 'p2', data: { reset: false } }).success).toBe(false);
    expect(VoiceSignalSchema.safeParse({ to: 'x'.repeat(40), data: { candidate: null } }).success).toBe(false);
    expect(VoiceSignalSchema.safeParse({ to: 'p2', data: { description: { type: 'offer', sdp: 'x'.repeat(15_001) } } }).success).toBe(false);
  });
});
