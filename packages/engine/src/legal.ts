import { applyIntent } from './apply';
import { autoPayment } from './payment';
import { cardColors, getCard, isAction } from './sets';
import { autoDiscard } from './turn';
import type { GameState, Intent } from './types';
import { stateFromView, type GameView } from './view';

/** Players whose input the game is currently waiting for. */
export function waitingOn(s: GameState): string[] {
  if (s.winner) return [];
  if (s.turn.phase === 'awaitingResponses' && s.pending) {
    const ids = new Set<string>();
    for (const t of s.pending.targets) {
      if (t.stage === 'respond' || t.stage === 'pay') ids.add(t.playerId);
      if (t.stage === 'counter') ids.add(s.pending.actorId);
    }
    return [...ids];
  }
  return [s.turn.playerId];
}

/** Cheap superset of possible intents. Some may be illegal; see legalIntents. */
export function candidateIntents(s: GameState, playerId: string): Intent[] {
  const out: Intent[] = [];
  const p = s.players.find((x) => x.id === playerId);
  if (s.winner || !p) return out;

  if (s.turn.phase === 'awaitingResponses' && s.pending) {
    const pending = s.pending;
    const jsn = p.hand.find((id) => isAction(id, 'justSayNo'));
    for (const t of pending.targets) {
      if (t.stage === 'respond' && t.playerId === playerId) {
        out.push({ type: 'acceptAction' });
        if (jsn) out.push({ type: 'respondJustSayNo', card: jsn });
      }
      if (t.stage === 'counter' && pending.actorId === playerId) {
        out.push({ type: 'acceptAction', targetPlayer: t.playerId });
        if (jsn) out.push({ type: 'respondJustSayNo', card: jsn, targetPlayer: t.playerId });
      }
      if (t.stage === 'pay' && t.playerId === playerId) out.push({ type: 'pay', cards: autoPayment(p, pending.amount) });
    }
    return out;
  }

  if (s.turn.playerId !== playerId) return out;
  if (s.turn.phase === 'discard') return [{ type: 'discard', cards: autoDiscard(p) }];

  out.push({ type: 'endTurn' });
  const opponents = s.players.filter((o) => o.id !== playerId);
  const doubles = p.hand.filter((id) => isAction(id, 'doubleRent'));
  for (const id of new Set(p.hand)) {
    const card = getCard(id);
    if (card.type === 'property' || card.type === 'wild') {
      for (const color of cardColors(id)) out.push({ type: 'playProperty', card: id, color });
      continue;
    }
    out.push({ type: 'playToBank', card: id });
    if (card.type === 'rent') {
      for (const color of card.colors) {
        for (let n = 0; n <= Math.min(2, doubles.length); n++) {
          const d = doubles.slice(0, n);
          if (card.any) for (const o of opponents) out.push({ type: 'playRent', card: id, color, target: o.id, doubles: d });
          else out.push({ type: 'playRent', card: id, color, doubles: d });
        }
      }
      continue;
    }
    if (card.type !== 'action') continue;
    switch (card.action) {
      case 'passGo':
        out.push({ type: 'playPassGo', card: id });
        break;
      case 'birthday':
        out.push({ type: 'playBirthday', card: id });
        break;
      case 'debtCollector':
        for (const o of opponents) out.push({ type: 'playDebtCollector', card: id, target: o.id });
        break;
      case 'slyDeal':
        for (const o of opponents) for (const g of o.groups) for (const c of g.cards) out.push({ type: 'playSlyDeal', card: id, targetCard: c });
        break;
      case 'forcedDeal':
        for (const mg of p.groups) for (const mc of mg.cards) for (const o of opponents) for (const g of o.groups) for (const c of g.cards) {
          out.push({ type: 'playForcedDeal', card: id, myCard: mc, targetCard: c });
        }
        break;
      case 'dealBreaker':
        for (const o of opponents) for (const g of o.groups) out.push({ type: 'playDealBreaker', card: id, targetGroup: g.id });
        break;
      case 'house':
        for (const g of p.groups) out.push({ type: 'playHouse', card: id, group: g.id });
        break;
      case 'hotel':
        for (const g of p.groups) out.push({ type: 'playHotel', card: id, group: g.id });
        break;
      default:
        break;
    }
  }
  for (const g of p.groups) {
    for (const c of g.cards) {
      for (const color of cardColors(c)) {
        out.push({ type: 'moveProperty', card: c, toGroup: 'new', color });
        for (const tg of p.groups) if (tg.id !== g.id && tg.color === color) out.push({ type: 'moveProperty', card: c, toGroup: tg.id, color });
      }
    }
  }
  return out;
}

/** Every intent that would succeed right now. Used by the UI to enable controls. */
export function legalIntents(s: GameState, playerId: string): Intent[] {
  return candidateIntents(s, playerId).filter((intent) => applyIntent(s, playerId, intent).ok);
}

/** legalIntents for the viewer, computed from their redacted view (used by the web client). */
export function legalIntentsForView(v: GameView): Intent[] {
  return legalIntents(stateFromView(v), v.me);
}

/** waitingOn, computed from a redacted view. */
export function waitingOnView(v: GameView): string[] {
  return waitingOn(stateFromView(v));
}
