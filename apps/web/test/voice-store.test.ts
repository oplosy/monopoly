import type { Ack, IceServer, SeatInfo, SignalData, VoiceState as SeatVoice } from '@deal-city/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryVoicePrefs } from '../src/voice/settings';
import { createVoiceStore, type SignalChannel } from '../src/voice/voice-store';
import { FakePc, fakeTrack, flush } from './fake-rtc';

const ICE: IceServer[] = [{ urls: 'stun:stun.example:3478' }];
const seat = (playerId: string, voice: SeatVoice): SeatInfo => ({ playerId, nickname: playerId, connected: true, avatar: 0, voice });

function setup(opts: { mic?: 'ok' | 'refused'; slowMic?: boolean; prefs?: ReturnType<typeof memoryVoicePrefs> } = {}) {
  FakePc.all = [];
  let listener: (from: string, data: SignalData) => void = () => {};
  const channel = {
    join: vi.fn(async (): Promise<Ack<{ iceServers: IceServer[] }>> => ({ ok: true, iceServers: ICE })),
    leave: vi.fn(),
    mic: vi.fn(),
    signal: vi.fn(),
    onSignal: (l: typeof listener) => void (listener = l),
  } satisfies SignalChannel;
  const micTrack = fakeTrack();
  const stream = { getTracks: () => [micTrack], getAudioTracks: () => [micTrack] } as unknown as MediaStream;
  let grantMic = () => {};
  const levels: Record<string, number> = {};
  const playbacks: Record<string, { setVolume: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> }> = {};
  const trackOwner = new Map<MediaStreamTrack, string>([[micTrack, 'me']]);
  const prefs = opts.prefs ?? memoryVoicePrefs();
  const store = createVoiceStore({
    channel,
    prefs,
    getMic: vi.fn(async () => {
      if (opts.mic === 'refused') throw new DOMException('denied', 'NotAllowedError');
      if (opts.slowMic) return new Promise<MediaStream>((resolve) => (grantMic = () => resolve(stream)));
      return stream;
    }),
    createPc: (config) => new FakePc(config) as unknown as RTCPeerConnection,
    play: (track) => {
      const p = { setVolume: vi.fn(), close: vi.fn() };
      playbacks[trackOwner.get(track) ?? '?'] = p;
      return p;
    },
    meter: (track) => ({ level: () => levels[trackOwner.get(track) ?? '?'] ?? 0, close: vi.fn() }),
  });
  /** Bob's audio arrives on the newest connection. */
  const remoteTrack = (owner: string) => {
    const t = fakeTrack();
    trackOwner.set(t, owner);
    FakePc.all.at(-1)!.ontrack?.({ track: t, streams: [] });
  };
  return { store, channel, micTrack, levels, playbacks, prefs, remoteTrack, grantMic: () => grantMic(), signal: (from: string, data: SignalData) => listener(from, data) };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('voice store', () => {
  it('joins with the mic open, then connects to each other player in voice', async () => {
    const { store, channel, micTrack } = setup();
    store.getState().sync('ABCDEF', 'p1', [seat('p1', 'off'), seat('p2', 'listening'), seat('p3', 'off')]);
    await store.getState().join();
    expect(store.getState()).toMatchObject({ status: 'on', hasMic: true, micOn: true });
    expect(channel.mic).toHaveBeenCalledWith(true);
    // Only Bob is in voice: one connection, polite because p1 sorts first, with the ICE servers from the join.
    expect(FakePc.all).toHaveLength(1);
    expect(FakePc.all[0]!.config).toEqual({ iceServers: ICE });
    await flush();
    expect(FakePc.all[0]!.sender.replaceTrack).toHaveBeenCalledWith(micTrack);
    store.getState().sync('ABCDEF', 'p1', [seat('p1', 'talking'), seat('p2', 'listening'), seat('p3', 'listening')]);
    expect(FakePc.all).toHaveLength(2);
  });

  it('joins as a listener when the mic is refused, and never opens a mic', async () => {
    const { store, channel } = setup({ mic: 'refused' });
    await store.getState().join();
    expect(store.getState()).toMatchObject({ status: 'on', hasMic: false, micOn: false });
    expect(channel.join).toHaveBeenCalled();
    expect(channel.mic).not.toHaveBeenCalledWith(true);
  });

  it('gives up an automatic rejoin when the mic needs a gesture, back to Join voice', async () => {
    const { store, channel } = setup({ mic: 'refused' });
    await store.getState().join({ auto: true });
    expect(store.getState().status).toBe('off');
    expect(channel.join).not.toHaveBeenCalled();
  });

  it('closes and opens the mic without dropping the track', async () => {
    const { store, channel, micTrack } = setup();
    await store.getState().join();
    await store.getState().setMic(false);
    expect(micTrack.enabled).toBe(false);
    expect(channel.mic).toHaveBeenLastCalledWith(false);
    await store.getState().setMic(true);
    expect(micTrack.enabled).toBe(true);
  });

  it('under push-to-talk opens the mic only while the key is held, and remembers the choice', async () => {
    const { store, channel, micTrack, prefs } = setup();
    await store.getState().join();
    store.getState().setPushToTalk(true);
    expect(store.getState().micOn).toBe(false);
    expect(prefs.load().pushToTalk).toBe(true);
    store.getState().talk(true);
    expect(micTrack.enabled).toBe(true);
    expect(channel.mic).toHaveBeenLastCalledWith(true);
    store.getState().talk(false);
    expect(micTrack.enabled).toBe(false);
    store.getState().setPushToTalk(false);
    expect(store.getState().micOn).toBe(true);
  });

  it('plays each player at the voice volume, silent while muted', async () => {
    const { store, playbacks, prefs, remoteTrack } = setup();
    store.getState().sync('ABCDEF', 'p1', [seat('p1', 'off'), seat('p2', 'talking')]);
    await store.getState().join();
    remoteTrack('p2');
    expect(playbacks.p2!.setVolume).toHaveBeenLastCalledWith(1);
    store.getState().setVolume(0.5);
    expect(playbacks.p2!.setVolume).toHaveBeenLastCalledWith(0.5);
    store.getState().mute('p2', true);
    expect(playbacks.p2!.setVolume).toHaveBeenLastCalledWith(0);
    expect(prefs.load()).toMatchObject({ volume: 0.5, muted: ['p2'] });
  });

  it('shows who is talking from their levels, with the hang time', async () => {
    const { store, levels, remoteTrack } = setup();
    store.getState().sync('ABCDEF', 'p1', [seat('p1', 'off'), seat('p2', 'talking')]);
    await store.getState().join();
    remoteTrack('p2');
    levels.p2 = 0.3;
    levels.me = 0.3;
    vi.advanceTimersByTime(100);
    expect(store.getState().talking.sort()).toEqual(['p1', 'p2']);
    levels.p2 = 0;
    vi.advanceTimersByTime(200);
    expect(store.getState().talking).toContain('p2');
    vi.advanceTimersByTime(200);
    expect(store.getState().talking).not.toContain('p2');
  });

  it('closes a player’s connection and playback when they leave voice', async () => {
    const { store, playbacks, remoteTrack } = setup();
    store.getState().sync('ABCDEF', 'p1', [seat('p1', 'off'), seat('p2', 'talking')]);
    await store.getState().join();
    remoteTrack('p2');
    const pc = FakePc.all[0]!;
    pc.setState('connected');
    expect(store.getState().connections).toEqual({ p2: 'connected' });
    store.getState().sync('ABCDEF', 'p1', [seat('p1', 'listening'), seat('p2', 'off')]);
    expect(pc.close).toHaveBeenCalled();
    expect(playbacks.p2!.close).toHaveBeenCalled();
    expect(store.getState().connections).toEqual({});
  });

  it('answers an offer from a player it has not seen in voice yet', async () => {
    const { store, signal } = setup();
    store.getState().sync('ABCDEF', 'p1', [seat('p1', 'off'), seat('p2', 'off')]);
    await store.getState().join();
    expect(FakePc.all).toHaveLength(0);
    signal('p2', { description: { type: 'offer', sdp: 'x' } });
    await flush();
    expect(FakePc.all).toHaveLength(1);
    expect(FakePc.all[0]!.received).toEqual([{ type: 'offer', sdp: 'x' }]);
  });

  it('leaves: everything stops, and no rejoin is remembered', async () => {
    const { store, channel, micTrack, prefs } = setup();
    store.getState().sync('ABCDEF', 'p1', [seat('p1', 'off'), seat('p2', 'listening')]);
    await store.getState().join();
    expect(prefs.rejoinCode()).toBe('ABCDEF');
    store.getState().leave();
    expect(channel.leave).toHaveBeenCalled();
    expect(micTrack.stop).toHaveBeenCalled();
    expect(FakePc.all[0]!.close).toHaveBeenCalled();
    expect(store.getState()).toMatchObject({ status: 'off', micOn: false, talking: [], connections: {} });
    expect(prefs.rejoinCode()).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('leaving while the mic prompt is still open leaves no mic running', async () => {
    const { store, micTrack, grantMic } = setup({ slowMic: true });
    const pending = store.getState().join();
    store.getState().leave();
    grantMic();
    await pending;
    expect(store.getState().status).toBe('off');
    expect(micTrack.stop).toHaveBeenCalled();
  });

  it('rejoins once after the connection comes back, and after a reload in the same room', async () => {
    const prefs = memoryVoicePrefs({}, 'ABCDEF');
    const { store, channel } = setup({ prefs });
    store.getState().sync('ABCDEF', 'p1', [seat('p1', 'off')]);
    store.getState().online();
    await flush();
    expect(channel.join).toHaveBeenCalledTimes(1);
    expect(store.getState().status).toBe('on');
    store.getState().offline();
    expect(store.getState().status).toBe('off');
    store.getState().online();
    await flush();
    expect(channel.join).toHaveBeenCalledTimes(2);
    store.getState().sync('ZZZZZZ', 'p1', [seat('p1', 'off')]);
    store.getState().hangUp();
    store.getState().online();
    await flush();
    // Another room: no automatic rejoin.
    expect(channel.join).toHaveBeenCalledTimes(2);
  });
});
