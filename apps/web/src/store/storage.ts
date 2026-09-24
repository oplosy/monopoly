import { AVATAR_COUNT } from '@deal-city/protocol/constants';

export interface SavedSession {
  code: string;
  playerId: string;
  token: string;
}

export interface SessionStore {
  load(): SavedSession | null;
  save(session: SavedSession): void;
  clear(): void;
  loadNickname(): string;
  saveNickname(nickname: string): void;
  /** The character this browser likes to play as, or null. */
  loadAvatar(): number | null;
  saveAvatar(avatar: number): void;
}

const SESSION_KEY = 'dealcity.session';
const NICKNAME_KEY = 'dealcity.nickname';
const AVATAR_KEY = 'dealcity.avatar';

function isSaved(x: unknown): x is SavedSession {
  const s = x as Partial<SavedSession> | null;
  return !!s && typeof s.code === 'string' && typeof s.playerId === 'string' && typeof s.token === 'string';
}

function toAvatar(raw: string | null): number | null {
  if (raw === null || !/^\d{1,2}$/.test(raw)) return null;
  const n = Number(raw);
  return n < AVATAR_COUNT ? n : null;
}

/** Reads and writes that never throw: storage can be blocked (private mode, disabled site data). */
function safe(area: () => Storage) {
  return {
    get(key: string): string | null {
      try {
        return area().getItem(key);
      } catch {
        return null;
      }
    },
    set(key: string, value: string | null): void {
      try {
        if (value === null) area().removeItem(key);
        else area().setItem(key, value);
      } catch {
        // Storage is blocked: nothing persists, the game still works for this page.
      }
    },
  };
}

/**
 * The seat token lives in sessionStorage, so each tab is its own player and a reload keeps the seat.
 * The nickname and the preferred character are shared across tabs through localStorage.
 */
export function browserStorage(): SessionStore {
  const tab = safe(() => window.sessionStorage);
  const shared = safe(() => window.localStorage);
  return {
    load() {
      const raw = tab.get(SESSION_KEY);
      if (!raw) return null;
      try {
        const parsed: unknown = JSON.parse(raw);
        return isSaved(parsed) ? parsed : null;
      } catch {
        return null;
      }
    },
    save(session) {
      tab.set(SESSION_KEY, JSON.stringify(session));
    },
    clear() {
      tab.set(SESSION_KEY, null);
    },
    loadNickname() {
      return shared.get(NICKNAME_KEY) ?? '';
    },
    saveNickname(nickname) {
      shared.set(NICKNAME_KEY, nickname);
    },
    loadAvatar() {
      return toAvatar(shared.get(AVATAR_KEY));
    },
    saveAvatar(avatar) {
      shared.set(AVATAR_KEY, String(avatar));
    },
  };
}

export function memoryStorage(initial: SavedSession | null = null, nickname = '', avatar: number | null = null): SessionStore {
  let session = initial;
  let nick = nickname;
  let character = avatar;
  return {
    load: () => session,
    save: (s) => {
      session = s;
    },
    clear: () => {
      session = null;
    },
    loadNickname: () => nick,
    saveNickname: (n) => {
      nick = n;
    },
    loadAvatar: () => character,
    saveAvatar: (a) => {
      character = a;
    },
  };
}
