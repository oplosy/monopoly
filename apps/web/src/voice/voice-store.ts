import type { Ack, IceServer, SeatInfo, SignalData } from '@deal-city/protocol';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { createPeer, type Peer } from './peer';
import type { VoicePrefs } from './settings';
import { createTalkDetector, LEVEL_EVERY_MS } from './talking';

/** How the voice module talks to the server; the game's socket implements it (channel.ts), tests fake it. */
export interface SignalChannel {
  join(): Promise<Ack<{ iceServers: IceServer[] }>>;
  leave(): void;
  mic(on: boolean): void;
  signal(to: string, data: SignalData): void;
  onSignal(listener: (from: string, data: SignalData) => void): void;
}

export interface Playback {
  setVolume(v: number): void;
  close(): void;
}

export interface Meter {
  /** RMS level, 0 to 1. */
  level(): number;
  close(): void;
}

export interface VoiceDeps {
  channel: SignalChannel;
  /** The microphone, with echo cancellation, noise suppression and auto gain control; rejects when refused. */
  getMic(): Promise<MediaStream>;
  createPc(config: RTCConfiguration): RTCPeerConnection;
  play(track: MediaStreamTrack): Playback;
  meter(track: MediaStreamTrack): Meter;
  prefs: VoicePrefs;
}

export type VoiceStatus = 'off' | 'joining' | 'on';

export interface VoiceState {
  status: VoiceStatus;
  /** A microphone was granted; without one this player only listens. */
  hasMic: boolean;
  micOn: boolean;
  pushToTalk: boolean;
  volume: number;
  muted: string[];
  /** Players (me included) whose level says they are talking now. */
  talking: string[];
  connections: Record<string, RTCPeerConnectionState>;
  join(opts?: { auto?: boolean }): Promise<void>;
  /** Leaves voice on purpose: no automatic rejoin. */
  leave(): void;
  /** Ends the call because the room page went away; a reload in the same room still rejoins. */
  hangUp(): void;
  setMic(on: boolean): Promise<void>;
  /** Push-to-talk: the key or the button is held (true) or let go (false). */
  talk(down: boolean): void;
  setPushToTalk(on: boolean): void;
  setVolume(v: number): void;
  mute(playerId: string, on: boolean): void;
  /** The room as the server sees it: who is in voice. */
  sync(code: string, me: string, seats: readonly SeatInfo[]): void;
  /** The seat is live again (after connecting or resuming). */
  online(): void;
  /** The socket dropped: the server has already taken this seat out of voice. */
  offline(): void;
}

export type VoiceStore = StoreApi<VoiceState>;

interface Link {
  peer: Peer;
  playback: Playback | null;
  meter: Meter | null;
  rebuilt: boolean;
}

export function createVoiceStore(deps: VoiceDeps): VoiceStore {
  const { channel, prefs } = deps;
  const saved = prefs.load();
  const links = new Map<string, Link>();
  const detectors = new Map<string, (level: number, now: number) => boolean>();
  let mic: MediaStream | null = null;
  let micMeter: Meter | null = null;
  let iceServers: IceServer[] = [];
  let timer: ReturnType<typeof setInterval> | null = null;
  // Bumped by every leave: a join still waiting on the mic or the server sees it and backs out.
  let generation = 0;
  let room: { code: string; me: string; seats: readonly SeatInfo[] } = { code: '', me: '', seats: [] };
  let rejoinPending = false;

  const store = createStore<VoiceState>()((set, get) => {
    const micTrack = () => mic?.getAudioTracks()[0] ?? null;

    function applyMic(on: boolean): void {
      const track = micTrack();
      const open = on && track !== null;
      if (track) track.enabled = open;
      if (get().micOn !== open || get().status === 'on') channel.mic(open);
      set({ micOn: open });
    }

    function volumeFor(playerId: string): number {
      const { volume, muted } = get();
      return muted.includes(playerId) ? 0 : volume;
    }

    function save(): void {
      const { pushToTalk, volume, muted } = get();
      prefs.save({ pushToTalk, volume, muted });
    }

    function closeLink(playerId: string): void {
      const link = links.get(playerId);
      if (!link) return;
      link.peer.close();
      link.playback?.close();
      link.meter?.close();
      links.delete(playerId);
      detectors.delete(playerId);
      set((s) => {
        const connections = { ...s.connections };
        delete connections[playerId];
        return { connections, talking: s.talking.filter((id) => id !== playerId) };
      });
    }

    function openLink(playerId: string, rebuilt = false): Link {
      const pc = deps.createPc({ iceServers: iceServers as RTCIceServer[] });
      const link: Link = { peer: null as unknown as Peer, playback: null, meter: null, rebuilt };
      link.peer = createPeer({
        pc,
        polite: room.me < playerId,
        send: (data) => channel.signal(playerId, data),
        onTrack: (track) => {
          link.playback?.close();
          link.meter?.close();
          link.playback = deps.play(track);
          link.playback.setVolume(volumeFor(playerId));
          link.meter = deps.meter(track);
        },
        onState: (state) => {
          if (links.get(playerId) !== link) return;
          set((s) => ({ connections: { ...s.connections, [playerId]: state } }));
        },
        onFailed: () => {
          if (links.get(playerId) !== link || link.rebuilt) return;
          closeLink(playerId);
          links.set(playerId, openLink(playerId, true));
        },
      });
      const track = micTrack();
      if (track) void link.peer.setTrack(track);
      set((s) => ({ connections: { ...s.connections, [playerId]: 'new' } }));
      return link;
    }

    function reconcile(): void {
      if (get().status !== 'on') return;
      const inVoice = new Set(room.seats.filter((s) => s.playerId !== room.me && s.voice !== 'off').map((s) => s.playerId));
      for (const id of [...links.keys()]) if (!inVoice.has(id)) closeLink(id);
      for (const id of inVoice) if (!links.has(id)) links.set(id, openLink(id));
    }

    function readLevels(): void {
      const now = Date.now();
      const talking: string[] = [];
      const detect = (id: string, level: number) => {
        let d = detectors.get(id);
        if (!d) detectors.set(id, (d = createTalkDetector()));
        if (d(level, now)) talking.push(id);
      };
      detect(room.me, get().micOn && micMeter ? micMeter.level() : 0);
      for (const [id, link] of links) detect(id, link.meter?.level() ?? 0);
      const before = get().talking;
      if (talking.length !== before.length || talking.some((id) => !before.includes(id))) set({ talking });
    }

    function stopAll(): void {
      generation++;
      for (const id of [...links.keys()]) closeLink(id);
      for (const t of mic?.getTracks() ?? []) t.stop();
      mic = null;
      micMeter?.close();
      micMeter = null;
      if (timer) clearInterval(timer);
      timer = null;
      detectors.clear();
      set({ status: 'off', hasMic: false, micOn: false, talking: [], connections: {} });
    }

    channel.onSignal((from, data) => {
      if (get().status !== 'on' || from === room.me) return;
      // An offer can arrive before the room state that shows its sender in voice.
      let link = links.get(from);
      if (!link) links.set(from, (link = openLink(from)));
      void link.peer.handle(data).catch((err) => console.warn('voice: signal failed', err));
    });

    return {
      status: 'off',
      hasMic: false,
      micOn: false,
      pushToTalk: saved.pushToTalk,
      volume: saved.volume,
      muted: saved.muted,
      talking: [],
      connections: {},

      async join(opts = {}) {
        if (get().status !== 'off') return;
        const mine = ++generation;
        set({ status: 'joining' });
        let stream: MediaStream | null = null;
        try {
          stream = await deps.getMic();
        } catch {
          if (opts.auto) {
            // Without a gesture the browser may refuse: back to the Join voice button.
            prefs.setRejoinCode(null);
            if (mine === generation) set({ status: 'off' });
            return;
          }
        }
        const stop = () => stream?.getTracks().forEach((t) => t.stop());
        if (mine !== generation) return stop();
        const res = await channel.join();
        if (mine !== generation) return stop();
        if (!res.ok) {
          stop();
          set({ status: 'off' });
          return;
        }
        iceServers = res.iceServers;
        mic = stream;
        const track = micTrack();
        micMeter = track ? deps.meter(track) : null;
        prefs.setRejoinCode(room.code || null);
        set({ status: 'on', hasMic: track !== null });
        applyMic(!get().pushToTalk);
        timer = setInterval(readLevels, LEVEL_EVERY_MS);
        reconcile();
      },
      leave() {
        const was = get().status;
        prefs.setRejoinCode(null);
        rejoinPending = false;
        stopAll();
        if (was !== 'off') channel.leave();
      },
      hangUp() {
        const was = get().status;
        rejoinPending = false;
        stopAll();
        if (was !== 'off') channel.leave();
      },
      async setMic(on) {
        if (get().status !== 'on') return;
        if (on && !micTrack()) {
          // A listener asks again, with a gesture this time.
          try {
            mic = await deps.getMic();
          } catch {
            return;
          }
          const track = micTrack()!;
          micMeter = deps.meter(track);
          set({ hasMic: true });
          for (const link of links.values()) void link.peer.setTrack(track);
        }
        applyMic(on);
      },
      talk(down) {
        if (get().status === 'on' && get().pushToTalk && get().micOn !== down) applyMic(down);
      },
      setPushToTalk(on) {
        set({ pushToTalk: on });
        save();
        if (get().status === 'on') applyMic(!on);
      },
      setVolume(v) {
        set({ volume: Math.min(1, Math.max(0, v)) });
        save();
        for (const [id, link] of links) link.playback?.setVolume(volumeFor(id));
      },
      mute(playerId, on) {
        set((s) => ({ muted: on ? [...new Set([...s.muted, playerId])] : s.muted.filter((m) => m !== playerId) }));
        save();
        links.get(playerId)?.playback?.setVolume(volumeFor(playerId));
      },
      sync(code, me, seats) {
        room = { code, me, seats };
        reconcile();
      },
      online() {
        if (get().status !== 'off') return;
        if (rejoinPending || (room.code && prefs.rejoinCode() === room.code)) {
          rejoinPending = false;
          void get().join({ auto: true });
        }
      },
      offline() {
        if (get().status === 'off') return;
        rejoinPending = true;
        stopAll();
      },
    };
  });

  return store;
}
