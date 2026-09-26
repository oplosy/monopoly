# In-room text chat and voice chat

Date: 2026-09-26. Status: design approved in conversation, awaiting review of this written spec.

## 1. Purpose

Deal City is played by two or three friends who are not in the same place. For a long while they will play on the host's own computer, reached through a Cloudflare quick tunnel. Later the game will run on a public server. The friends need to talk while they play: a plain text chat, and voice. Both must work across home and mobile networks, from the tunnel as well as from a public server.

## 2. What the user decided

- **Text chat: plain.** Type and send, with no reactions or quick phrases.
- **Voice mic mode: open by default, push-to-talk as a setting.** The mic is open while in voice; push-to-talk can be switched on in settings.
- **Voice connectivity: peer-to-peer WebRTC with a relay fallback.** The browsers connect directly; when a network blocks that, the audio goes through Cloudflare Realtime TURN. The game server only brokers the connection and never carries audio.
- **Delivery: two parts.** Part A is text chat and Part B is voice. Each gets its own plan and its own PR, and B builds on A.

## 3. Part A: text chat

### 3.1 What the player sees

- **At the table:**
  - A round chat button stands in the top right corner of the UI layer, beside the settings gear. While messages are unread, a count badge sits on it.
  - The button opens a chat panel from the right: the same sheet as the game log. The messages are on top, and a text box with a Send button is at the bottom. Enter sends; Esc closes.
  - While the panel is closed, a new message also shows for 3 s as a small bubble beside its sender's seat.
- **In the lobby:** the same chat, always open, inside the room panel.
- **One conversation per room.** It carries on from the lobby into the game, through the game-over screen and a rematch, until the room closes.
- **Display:** every message shows its sender's nickname and is rendered as plain text; React escapes it, and no HTML or markdown is interpreted.

### 3.2 Protocol

- **Client → server:** `chat:send { text }`, acked with `Ack`.
- **Server → client:** `chat:message ChatMessage`, where `ChatMessage` is `{ id: number; from: string; name: string; text: string; at: number }`. Its fields:
  - `id` counts up within the room;
  - `from` is a player id;
  - `name` is the sender's nickname when they sent it, so history lines keep a name after their sender leaves;
  - `at` is epoch ms.
- **History:** `RoomState` gains nothing. On attach (join or resume) the server sends the room's history as `chat:history ChatMessage[]`, and the client replaces its list with it.

### 3.3 Server

- **Storage:** each `Room` keeps its last 50 messages in memory, never on disk. They go when the room goes.
- **Validation:**
  - The text is trimmed, empty is refused (`badRequest`), and more than 200 characters is refused (`tooLong`).
  - The sender must hold a seat in the room (`noSession`).
- **Rate limit:** a chat limiter per connection, separate from the game's (at most 1 message per second and 5 per 10 s), answers `rateLimited`.
- **Seatless messages:** a message from a player who has since left keeps its `from` and its `name`, so a player who joined after they left still sees who wrote it.

### 3.4 Client

- **Store** (`game-store.ts`):
  - `chat: ChatMessage[]` (at most 50) and `chatUnread: number`.
  - `sendChat(text)`, refused while offline, as the other actions are.
  - `markChatRead()`.
  - `chat:history` replaces the list, and `chat:message` appends to it. `chatUnread` counts only other players' messages while the panel is closed.
- **Components:**
  - `ChatPanel` (the sheet, reusing `useDialogFocus` and the log drawer's styles);
  - `ChatButton` (the button and its badge, in the HUD's corner);
  - `ChatBubble` (at the seat, stage px);
  - the lobby's inline chat.

### 3.5 Tests

- **Server, unit:** validation, the limiter, broadcast to the room only, the 50-message cap, history on resume, and a message from a player who left.
- **Client:** the store (history, append, unread counts, offline refusal); the panel (send with Enter, focus, plain-text rendering of `<b>`); the bubble timing.
- **e2e:** two players. A message sent at the table shows in the other's panel, and as a bubble while the panel is closed. A message sent in the lobby is still there in the game.

## 4. Part B: voice chat

### 4.1 What the player sees

- **Joining:**
  - A **Join voice** button stands beside the chat button, at the table and in the lobby. Pressing it asks the browser for the microphone.
  - If the player allows it, they join as a talker. If not, they join as a listener: they hear the others, and the others do not hear them.
  - Nobody is put into voice without pressing the button; browsers also require a gesture to play sound.
- **In voice:**
  - The button becomes a mic toggle. A long press (or right click) opens a small menu: **Leave voice** and **Push-to-talk** on/off.
  - **Push-to-talk:** the mic is closed until the player holds **V**; on a touch screen they hold the mic button instead. V typed in a text field types a V and never opens the mic.
  - **Each seat** gets a small speaker button that mutes that player for this listener only.
  - **The talking player's** avatar gets a pulsing green ring. A seat in voice shows a headset mark, and a crossed-out mic while that player's mic is closed.
  - **Settings:** a **Voice chat** row in the settings menu holds its own volume, separate from the game's sound volume.
  - Push-to-talk, the voice volume and the muted players are remembered in the browser (`localStorage`).
- **Losing the connection:** after a reload or a lost connection, the client tries once to rejoin voice by itself. If the browser refuses the mic without a gesture, the button falls back to **Join voice**.

### 4.2 Connection model

- **Mesh:** every player in voice holds one `RTCPeerConnection` to every other player in voice, which is three at most. Audio only (Opus), with echo cancellation, noise suppression and auto gain control on.
- **Negotiation:** the "perfect negotiation" pattern. The player whose id sorts first is the polite peer, so offers made at the same moment never deadlock.
- **A failed connection** gets an ICE restart first. If that fails, the connection is closed and made again.

### 4.3 Protocol

- **Client → server:**
  - `voice:join {}`, acked with `Ack<{ iceServers: RTCIceServer[] }>`;
  - `voice:leave {}`;
  - `voice:mic { on: boolean }`;
  - `voice:signal { to: string; data: SignalData }`, where `SignalData` is `{ description: RTCSessionDescriptionInit } | { candidate: RTCIceCandidateInit | null }`.
- **Server → client:** `voice:signal { from: string; data: SignalData }`.
- **Room state:** `SeatInfo` gains `voice: 'off' | 'listening' | 'talking'`.
  - `listening`: in voice with the mic off or never granted;
  - `talking`: in voice with the mic open. Under push-to-talk the mic reads as open while V is held.

### 4.4 Server

- **Voice membership:** each seat carries its voice state. Leaving the room, a dropped seat or a disconnect sets it to `off` and broadcasts the room state.
- **Signal relay:** `voice:signal` goes only to a player in the same room who is also in voice; anything else is refused with `badRequest`. The server never reads the signal's contents.
- **Size and rate limits:**
  - The signal's JSON must stay under 16 KB (`MAX_MESSAGE_BYTES` already caps every message).
  - Voice events have their own limiter (30 per second, as ICE candidates come in bursts), separate from the game's and the chat's.
- **TURN credentials:**
  - When both `CF_TURN_KEY_ID` and `CF_TURN_API_TOKEN` are set, the server asks Cloudflare `POST https://rtc.live.cloudflare.com/v1/turn/keys/<CF_TURN_KEY_ID>/credentials/generate-ice-servers` with `{ "ttl": 43200 }`.
  - It filters out URLs on port 53 (browsers block it) and caches the answer for 11 hours.
  - At most one request is in flight at a time, with a 5 s timeout.
  - When the keys are missing, or the request fails, the answer is `[{ urls: 'stun:stun.cloudflare.com:3478' }]`, and the failure is logged once. Voice still works on most networks.
- **Configuration:** the two variables are added to `loadConfig` and to the README's table. They never reach the browser.

### 4.5 Client

- **Module:** `apps/web/src/voice/`, independent of the game store. It holds:
  - the mic (`getUserMedia({ audio: { echoCancellation, noiseSuppression, autoGainControl } })`);
  - the peer connections;
  - the talking detection;
  - push-to-talk;
  - the settings.
- **Interface:** a small store with `join()`, `leave()`, `setMic(on)`, `setPushToTalk(on)`, `setVolume(v)` and `mute(playerId, on)`, and state for the UI (`status`, `micOn`, `talking: Set<playerId>`, `connections: Record<playerId, RTCPeerConnectionState>`).
- **Signalling:** it uses the same socket as the game store, through a small `SignalChannel` interface. That lets tests replace both the socket and `RTCPeerConnection`.
- **Talking detection:**
  - Each remote stream (and the local mic) feeds an `AnalyserNode`.
  - Its level is read every 100 ms. Talking starts above a threshold and ends after 300 ms below it.
- **Playback:**
  - Remote audio plays through one `<audio>` element per peer, with its volume set to the voice volume, or 0 when that player is muted.
  - Output starts only after the Join voice gesture.
- **Cleanup:** leaving voice, leaving the room or unmounting stops the mic tracks, closes every connection, and removes its listeners and timers.

### 4.6 Tests

- **Server, unit:**
  - signal relay: same room, in voice, refusals;
  - voice state through join, mic, leave and disconnect;
  - the TURN fetch with a fake `fetch`: success, port-53 filter, cache, failure fallback, keys missing.
- **Client, unit:** the voice store against a fake `RTCPeerConnection` and a fake signal channel:
  - offers and answers both ways;
  - the polite peer on a collision;
  - an ICE restart on failure;
  - mute and volume;
  - push-to-talk holding V, but not inside a text field;
  - cleanup.
- **e2e:** two players in Chrome with `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream`.
  - Both join voice; both connections reach `connected`.
  - Each hears the other: the remote audio's level rises above zero.
  - Seats show the talking ring. Closing the mic changes the seat's mark on the other side.

### 4.7 As built (Plan 14)

- **Ack before broadcast:** `voice:join` is acked with the ICE servers before the seat shows as in voice, so the joiner can answer the first offer. A signal from a player not yet seen in voice also opens a connection.
- **Mic muting:** closing the mic disables its track (`enabled = false`) and never renegotiates.
- **Voice options:** besides the long press and the right click, a small caret button opens the menu, so a keyboard can reach it.
- **Rejoin:** the automatic rejoin is keyed to the room code, kept in `sessionStorage` for the tab.
- **Seat marks:** they show at the table only; the lobby has the voice button beside its chat.
- **Failed connections:** after the ICE restart, a failed connection is rebuilt once per join, then shows "Could not connect".

## 5. Out of scope

- Video.
- Recording.
- Chat moderation beyond the length and rate limits.
- Persistent chat history.
- An SFU or more than three players.
- Echo handling beyond what the browser does.

## 6. Risks

- **Symmetric NATs without TURN keys:** voice will not connect on some mobile networks. The UI shows the peer's connection state ("Connecting…", "Could not connect") on that seat, so the failure is visible and not silent.
- **Autoplay and mic permission:** browsers vary. Everything starts from the Join voice press, and a refused permission leaves the player as a listener.
- **Tunnel:** only signalling goes through the quick tunnel (small Socket.IO messages). The audio goes directly or through TURN, never through our server.
