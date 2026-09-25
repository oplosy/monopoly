import { payableAssets, type GameView, type Intent } from '@deal-city/engine';
import { playBlocker, playOptions } from '../game/choices';
import { meAsPlayer, type Role } from '../game/derive';
import {
  targetKey,
  type Aim, type CardInteraction, type PickInteraction, type Selection, type TableInteraction, type TargetKind,
} from './interaction';

export interface ResolveActions {
  select(selection: Selection): void;
  cancel(): void;
  togglePay(cardId: string): void;
  toggleDiscard(cardId: string): void;
}

export interface ResolveInput {
  view: GameView;
  legal: readonly Intent[];
  role: Role;
  aim: Aim | null;
  selected: Selection;
  payPicked: readonly string[];
  discardPicked: readonly string[];
  actions: ResolveActions;
}

const NOTHING: PickInteraction = { target: false };
const nothing = (): PickInteraction => NOTHING;

/**
 * What clicking each card, set and seat does in the current mode. Aiming at a target comes first,
 * then paying, then discarding, then answering an action (hand cards only preview; the tray
 * holds the answers). Otherwise hand cards open their play popover and my movable table
 * cards open their move popover. Everything else only shows its preview. On my turn the hand cards I can play
 * are marked; the ones I cannot (my plays spent, or another player's turn) darken (spec 2026-09-25-table-controls D2).
 */
export function resolveInteraction({ view, legal, role, aim, selected, payPicked, discardPicked, actions }: ResolveInput): TableInteraction {
  const me = view.me;

  const handCard = (id: string): CardInteraction => {
    const open = selected?.zone === 'hand' && selected.card === id;
    const answers = legal.some((i) => i.type === 'respondJustSayNo' && i.card === id);
    const blocked = playBlocker(view, playOptions(legal, id)) !== null;
    return {
      tone: answers ? 'target' : blocked ? 'dim' : 'playable',
      pressed: open,
      onActivate: () => actions.select(open ? null : { zone: 'hand', card: id }),
    };
  };

  if (aim) {
    const pick = (kind: TargetKind, id: string): PickInteraction => {
      const run = aim.choices.get(targetKey(kind, id));
      return run ? { target: true, onPick: run } : NOTHING;
    };
    return {
      card(zone, id) {
        if (zone === 'hand' && id === aim.card) return { tone: 'normal', pressed: true, onActivate: actions.cancel };
        if (zone === 'hand') return { tone: 'normal' };
        const run = zone === 'tableau' ? pick('card', id).onPick : undefined;
        return run ? { tone: 'target', onActivate: run } : { tone: 'dim' };
      },
      group: (groupId) => pick('group', groupId),
      player: (playerId) => pick('player', playerId),
    };
  }

  if (role?.kind === 'pay') {
    const payable = new Set(payableAssets(meAsPlayer(view)));
    return {
      card(zone, id, owner) {
        if (zone === 'hand') return handCard(id);
        if (owner !== me || !payable.has(id)) return { tone: 'normal' };
        return { tone: 'selectable', pressed: payPicked.includes(id), onActivate: () => actions.togglePay(id) };
      },
      group: nothing,
      player: nothing,
    };
  }

  if (role?.kind === 'discard') {
    return {
      card: (zone, id) =>
        zone === 'hand' ? { tone: 'selectable', pressed: discardPicked.includes(id), onActivate: () => actions.toggleDiscard(id) } : { tone: 'normal' },
      group: nothing,
      player: nothing,
    };
  }

  if (role?.kind === 'respond' || role?.kind === 'counter') {
    // The answers live in the tray; hand cards only show their preview, so no play popover covers it.
    const answers = new Set(legal.flatMap((i) => (i.type === 'respondJustSayNo' ? [i.card] : [])));
    return {
      card: (zone, id) => (zone === 'hand' ? { tone: answers.has(id) ? 'target' : 'normal' } : { tone: 'normal' }),
      group: nothing,
      player: nothing,
    };
  }

  const canAct = view.turn.playerId === me && view.turn.phase === 'play' && !view.winner;
  const movable = new Set(legal.flatMap((i) => (i.type === 'moveProperty' ? [i.card] : [])));
  return {
    card(zone, id, owner) {
      if (zone === 'hand') return handCard(id);
      if (zone !== 'tableau' || owner !== me || !canAct || !movable.has(id)) return { tone: 'normal' };
      const open = selected?.zone === 'tableau' && selected.card === id;
      return { tone: 'normal', pressed: open, onActivate: () => actions.select(open ? null : { zone: 'tableau', card: id }) };
    },
    group: nothing,
    player: nothing,
  };
}
