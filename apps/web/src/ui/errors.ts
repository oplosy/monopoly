const MESSAGES: Record<string, string> = {
  badNickname: 'Pick a nickname of 1–16 characters.',
  roomNotFound: 'No room with that code. Check the code and try again.',
  roomFull: 'That room is full (3 players).',
  gameInProgress: 'That game has already started.',
  serverBusy: 'The server is full right now. Try again in a minute.',
  rateLimited: 'Slow down a little.',
  alreadyInRoom: 'You already have a seat in a room.',
  notHost: 'Only the host can do that.',
  notEnoughPlayers: 'You need at least 2 players to start.',
  sessionNotFound: 'Your seat is no longer held.',
  staleVersion: 'The table changed. Try again.',
  timeout: 'The server did not answer. Check your connection.',
  notYourTurn: "It's not your turn.",
  noPlaysLeft: 'You have no plays left this turn.',
  insufficientPayment: 'Select enough to cover what you owe, or everything you have.',
  hotelFirst: 'Pay the Hotel before its House.',
  internal: 'Something went wrong on the server.',
};

/** Human wording for a server or engine error code. */
export function errorMessage(code: string): string {
  return MESSAGES[code] ?? `That didn't work (${code}).`;
}
