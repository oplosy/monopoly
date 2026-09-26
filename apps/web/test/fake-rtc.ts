import { vi } from 'vitest';

type Desc = { type: 'offer' | 'answer' | 'pranswer' | 'rollback'; sdp?: string };

/** Enough of RTCPeerConnection for perfect negotiation: signaling states, descriptions, candidates, tracks. */
export class FakePc {
  static all: FakePc[] = [];
  signalingState: RTCSignalingState = 'stable';
  connectionState: RTCPeerConnectionState = 'new';
  localDescription: Desc | null = null;
  received: Desc[] = [];
  candidates: unknown[] = [];
  onnegotiationneeded: (() => void) | null = null;
  onicecandidate: ((e: { candidate: { toJSON(): unknown } | null }) => void) | null = null;
  ontrack: ((e: { track: MediaStreamTrack; streams: MediaStream[] }) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  sender = { track: null as MediaStreamTrack | null, replaceTrack: vi.fn(async (t: MediaStreamTrack | null) => void (this.sender.track = t)) };
  restartIce = vi.fn(() => queueMicrotask(() => this.onnegotiationneeded?.()));
  close = vi.fn(() => void (this.connectionState = 'closed'));
  private offers = 0;

  constructor(readonly config: unknown = {}) {
    FakePc.all.push(this);
  }
  addTransceiver() {
    queueMicrotask(() => this.onnegotiationneeded?.());
    return { sender: this.sender };
  }
  async setLocalDescription(d?: Desc) {
    const type = d?.type ?? (this.signalingState === 'have-remote-offer' ? 'answer' : 'offer');
    this.localDescription = { type, sdp: `${type}-${++this.offers}` };
    this.signalingState = type === 'offer' ? 'have-local-offer' : 'stable';
  }
  async setRemoteDescription(d: Desc) {
    this.received.push(d);
    // A polite peer's offer is rolled back implicitly, as browsers do.
    this.signalingState = d.type === 'offer' ? 'have-remote-offer' : 'stable';
  }
  async addIceCandidate(c: unknown) {
    this.candidates.push(c);
  }
  setState(s: RTCPeerConnectionState) {
    this.connectionState = s;
    this.onconnectionstatechange?.();
  }
}

export function fakeTrack(): MediaStreamTrack {
  return { enabled: true, stop: vi.fn(), kind: 'audio' } as unknown as MediaStreamTrack;
}

/** Lets queued microtasks and promise chains settle. */
export async function flush(times = 10): Promise<void> {
  for (let i = 0; i < times; i++) await Promise.resolve();
}
