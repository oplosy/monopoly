import type { SignalData } from '@deal-city/protocol';

export interface PeerOptions {
  pc: RTCPeerConnection;
  /** The polite peer yields when both sides offer at once (spec §4.2: the player whose id sorts first). */
  polite: boolean;
  send(data: SignalData): void;
  onTrack(track: MediaStreamTrack): void;
  onState(state: RTCPeerConnectionState): void;
  /** The connection failed again after an ICE restart: its owner rebuilds it or gives up. */
  onFailed(): void;
}

export interface Peer {
  handle(data: SignalData): Promise<void>;
  setTrack(track: MediaStreamTrack | null): Promise<void>;
  close(): void;
}

/** One audio connection to one other player, negotiated with the "perfect negotiation" pattern. */
export function createPeer({ pc, polite, send, onTrack, onState, onFailed }: PeerOptions): Peer {
  let makingOffer = false;
  let ignoreOffer = false;
  let restarted = false;
  let track: MediaStreamTrack | null = null;
  // One two-way audio line, opened by the impolite side only: a listener without a mic still receives, and a mic is added
  // without renegotiating. The polite side takes the line the first offer brings. If both sides opened their own, a
  // collision would leave each with two half-used lines (browsers never reuse a line added with addTransceiver).
  let sender: RTCRtpSender | null = polite ? null : pc.addTransceiver('audio', { direction: 'sendrecv' }).sender;

  pc.onnegotiationneeded = async () => {
    try {
      makingOffer = true;
      await pc.setLocalDescription();
      const d = pc.localDescription;
      if (d) send({ description: { type: d.type, sdp: d.sdp } });
    } catch (err) {
      console.warn('voice: could not make an offer', err);
    } finally {
      makingOffer = false;
    }
  };
  pc.onicecandidate = ({ candidate }) => send({ candidate: candidate ? (candidate.toJSON() as RTCIceCandidateInit) : null });
  pc.ontrack = ({ track }) => onTrack(track);
  pc.onconnectionstatechange = () => {
    const state = pc.connectionState;
    onState(state);
    if (state !== 'failed') return;
    if (!restarted) {
      restarted = true;
      pc.restartIce();
    } else {
      onFailed();
    }
  };

  return {
    async handle(data) {
      if ('description' in data) {
        const description = data.description;
        const collision = description.type === 'offer' && (makingOffer || pc.signalingState !== 'stable');
        ignoreOffer = !polite && collision;
        if (ignoreOffer) return;
        await pc.setRemoteDescription(description);
        if (description.type === 'offer' && !sender) {
          const line = pc.getTransceivers().find((t) => t.receiver.track.kind === 'audio');
          if (line) {
            line.direction = 'sendrecv';
            sender = line.sender;
            await sender.replaceTrack(track);
          }
        }
        if (description.type === 'offer') {
          await pc.setLocalDescription();
          const d = pc.localDescription;
          if (d) send({ description: { type: d.type, sdp: d.sdp } });
        }
      } else {
        try {
          await pc.addIceCandidate(data.candidate ?? undefined);
        } catch (err) {
          if (!ignoreOffer) console.warn('voice: bad candidate', err);
        }
      }
    },
    async setTrack(next) {
      track = next;
      if (sender) await sender.replaceTrack(next);
    },
    close() {
      pc.onnegotiationneeded = null;
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.close();
    },
  };
}
