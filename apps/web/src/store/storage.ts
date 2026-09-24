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
}

const SESSION_KEY = 'dealcity.session';
const NICKNAME_KEY = 'dealcity.nickname';

function isSaved(x: unknown): x is SavedSession {
  const s = x as Partial<SavedSession> | null;
  return !!s && typeof s.code === 'string' && typeof s.playerId === 'string' && typeof s.token === 'string';
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
 * The nickname is shared across tabs through localStorage.
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
  };
}

export function memoryStorage(initial: SavedSession | null = null, nickname = ''): SessionStore {
  let session = initial;
  let nick = nickname;
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
  };
}
