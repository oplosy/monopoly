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
  /** `mid` stays null until an answer settles the line, as in a browser; a rolled-back offer leaves it null. */
  transceivers: { mid: string | null; direction: RTCRtpTransceiverDirection; sender: FakePc['sender']; receiver: { track: { kind: string } } }[] = [];
  restartIce = vi.fn(() => queueMicrotask(() => this.onnegotiationneeded?.()));
  close = vi.fn(() => void (this.connectionState = 'closed'));
  private offers = 0;

  constructor(readonly config: unknown = {}) {
    FakePc.all.push(this);
  }
  addTransceiver() {
    const t = { mid: null as string | null, direction: 'sendrecv' as RTCRtpTransceiverDirection, sender: this.sender, receiver: { track: { kind: 'audio' } } };
    this.transceivers.push(t);
    queueMicrotask(() => this.onnegotiationneeded?.());
    return t;
  }
  getTransceivers() {
    return this.transceivers;
  }
  async setLocalDescription(d?: Desc) {
    const type = d?.type ?? (this.signalingState === 'have-remote-offer' ? 'answer' : 'offer');
    this.localDescription = { type, sdp: `${type}-${++this.offers}` };
    this.signalingState = type === 'offer' ? 'have-local-offer' : 'stable';
  }
  async setRemoteDescription(d: Desc) {
    this.received.push(d);
    // A remote offer brings its own audio line: browsers never reuse a line this side added with addTransceiver.
    if (d.type === 'offer' && !this.transceivers.some((t) => t.mid !== null))
      this.transceivers.push({ mid: '0', direction: 'recvonly', sender: this.sender, receiver: { track: { kind: 'audio' } } });
    if (d.type === 'answer') for (const t of this.transceivers) t.mid ??= '0';
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
