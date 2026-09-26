import type { SignalData } from '@deal-city/protocol';
import { describe, expect, it, vi } from 'vitest';
import { createPeer, type Peer } from '../src/voice/peer';
import { FakePc, fakeTrack, flush } from './fake-rtc';

function pair() {
  const pcA = new FakePc();
  const pcB = new FakePc();
  const peers: { a?: Peer; b?: Peer } = {};
  const noop = { onTrack: vi.fn(), onState: vi.fn(), onFailed: vi.fn() };
  peers.a = createPeer({ pc: pcA as unknown as RTCPeerConnection, polite: true, send: (d: SignalData) => void peers.b!.handle(d), ...noop });
  peers.b = createPeer({ pc: pcB as unknown as RTCPeerConnection, polite: false, send: (d: SignalData) => void peers.a!.handle(d), ...noop });
  const { a, b } = peers as Required<typeof peers>;
  return { pcA, pcB, a, b };
}

describe('createPeer', () => {
  it('settles two offers made at the same moment: the polite side answers, the impolite side ignores', async () => {
    const { pcA, pcB } = pair();
    await flush(30);
    expect(pcA.signalingState).toBe('stable');
    expect(pcB.signalingState).toBe('stable');
    // The impolite side dropped the colliding offer and took only the answer to its own.
    expect(pcB.received.map((d) => d.type)).toEqual(['answer']);
    expect(pcA.received.map((d) => d.type)).toEqual(['offer']);
  });

  it('passes candidates along, the end-of-candidates null included', async () => {
    const { pcA, pcB } = pair();
    await flush(30);
    pcA.onicecandidate?.({ candidate: { toJSON: () => ({ candidate: 'c1', sdpMid: '0', sdpMLineIndex: 0 }) } });
    pcA.onicecandidate?.({ candidate: null });
    await flush();
    expect(pcB.candidates).toEqual([{ candidate: 'c1', sdpMid: '0', sdpMLineIndex: 0 }, undefined]);
  });

  it('opens one audio line only, from the impolite side, so a collision never leaves two', async () => {
    const { pcA, pcB } = pair();
    await flush(30);
    expect(pcA.transceivers).toHaveLength(1);
    expect(pcB.transceivers).toHaveLength(1);
    // The polite side sends on the line the offer brought.
    expect(pcA.transceivers[0]!.direction).toBe('sendrecv');
  });

  it('on the polite side, sends my mic on the line the offer brings, even when the mic came first', async () => {
    const pc = new FakePc();
    const peer = createPeer({ pc: pc as unknown as RTCPeerConnection, polite: true, send: vi.fn(), onTrack: vi.fn(), onState: vi.fn(), onFailed: vi.fn() });
    const track = fakeTrack();
    await peer.setTrack(track);
    expect(pc.transceivers).toHaveLength(0);
    await peer.handle({ description: { type: 'offer', sdp: 'o' } });
    expect(pc.sender.replaceTrack).toHaveBeenCalledWith(track);
    expect(pc.localDescription?.type).toBe('answer');
  });

  it('sends my mic on its one audio sender, and hands the remote track over', async () => {
    const onTrack = vi.fn();
    const pc = new FakePc();
    const peer = createPeer({ pc: pc as unknown as RTCPeerConnection, polite: false, send: vi.fn(), onTrack, onState: vi.fn(), onFailed: vi.fn() });
    const track = fakeTrack();
    await peer.setTrack(track);
    expect(pc.sender.replaceTrack).toHaveBeenCalledWith(track);
    const remote = fakeTrack();
    pc.ontrack?.({ track: remote, streams: [] });
    expect(onTrack).toHaveBeenCalledWith(remote);
  });

  it('restarts ICE on the first failure and gives up to its owner on the second', async () => {
    const onFailed = vi.fn();
    const onState = vi.fn();
    const pc = new FakePc();
    const peer = createPeer({ pc: pc as unknown as RTCPeerConnection, polite: true, send: vi.fn(), onTrack: vi.fn(), onState, onFailed });
    pc.setState('failed');
    expect(pc.restartIce).toHaveBeenCalledTimes(1);
    expect(onFailed).not.toHaveBeenCalled();
    pc.setState('connected');
    pc.setState('failed');
    expect(onFailed).toHaveBeenCalledTimes(1);
    expect(onState.mock.calls.map((c) => c[0])).toEqual(['failed', 'connected', 'failed']);
    peer.close();
    expect(pc.close).toHaveBeenCalled();
  });
});
