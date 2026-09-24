import { isComplete } from './sets';
import { findGroup, getPlayer, placeProperty, removeProperty } from './zones';
import type { Ctx, Pending } from './types';

/** Applies a non-monetary action to one accepting target. If the table changed so it no longer applies, does nothing. */
export function applyEffect(ctx: Ctx, pending: Pending, targetId: string): void {
  const actor = getPlayer(ctx.s, pending.actorId);
  const owner = getPlayer(ctx.s, targetId);
  switch (pending.kind) {
    case 'slyDeal': {
      const card = pending.targetCard!;
      const group = findGroup(owner, card);
      if (!group || isComplete(group)) return;
      const color = removeProperty(ctx, owner, card);
      placeProperty(ctx.s, actor, card, color);
      ctx.events.push({ type: 'stolen', from: owner.id, to: actor.id, cards: [card] });
      return;
    }
    case 'forcedDeal': {
      const mine = pending.myCard!;
      const theirs = pending.targetCard!;
      const myGroup = findGroup(actor, mine);
      const theirGroup = findGroup(owner, theirs);
      if (!myGroup || !theirGroup || isComplete(myGroup) || isComplete(theirGroup)) return;
      const myColor = removeProperty(ctx, actor, mine);
      const theirColor = removeProperty(ctx, owner, theirs);
      placeProperty(ctx.s, actor, theirs, theirColor);
      placeProperty(ctx.s, owner, mine, myColor);
      ctx.events.push({ type: 'swapped', a: actor.id, b: owner.id, cardA: mine, cardB: theirs });
      return;
    }
    case 'dealBreaker': {
      const index = owner.groups.findIndex((g) => g.id === pending.targetGroup);
      const group = owner.groups[index];
      if (!group || !isComplete(group)) return;
      owner.groups.splice(index, 1);
      actor.groups.push(group);
      const cards = [...group.cards, ...(group.house ? [group.house] : []), ...(group.hotel ? [group.hotel] : [])];
      ctx.events.push({ type: 'stolen', from: owner.id, to: actor.id, cards });
      return;
    }
    default:
      return;
  }
}
