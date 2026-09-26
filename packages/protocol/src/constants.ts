/** Room limits, kept free of zod so the web client can import them cheaply. */
export const MAX_SEATS = 3;
export const MIN_PLAYERS = 2;
/** Player characters are numbered 0 to AVATAR_COUNT - 1. */
export const AVATAR_COUNT = 12;
/** Chat: the longest message, in characters after trimming, and how many messages a room keeps. */
export const CHAT_MAX_LENGTH = 200;
export const CHAT_HISTORY = 50;
