import type { Intent, IntentOf } from '@deal-city/engine';
import type { PlayOption } from '../game/choices';
import { targetKey } from './targeting';

export interface FlowActions {
  send(intent: Intent): void;
  aimAt(prompt: string, choices: [string, () => void][]): void;
}

const all = <K extends Intent['type']>(option: PlayOption) => option.intents as IntentOf<K>[];
const choice = (key: string, run: () => void): [string, () => void] => [key, run];

/**
 * Starts a menu option: sends it at once, or switches the table into target picking.
 * Returns false when the menu itself must ask for more (a property color, the rent form).
 */
export function startOption(option: PlayOption, act: FlowActions): boolean {
  const [first] = option.intents;
  if (!first) return true;
  switch (option.kind) {
    case 'property':
      if (option.intents.length > 1) return false;
      act.send(first);
      return true;
    case 'rent':
      return false;
    case 'debtCollector':
      act.aimAt('Pick a player to pay you 5M', all<'playDebtCollector'>(option).map((i) => choice(targetKey('player', i.target), () => act.send(i))));
      return true;
    case 'slyDeal':
      act.aimAt('Pick a property to steal', all<'playSlyDeal'>(option).map((i) => choice(targetKey('card', i.targetCard), () => act.send(i))));
      return true;
    case 'dealBreaker':
      act.aimAt('Pick a complete set to take', all<'playDealBreaker'>(option).map((i) => choice(targetKey('group', i.targetGroup), () => act.send(i))));
      return true;
    case 'house':
    case 'hotel': {
      const intents = all<'playHouse' | 'playHotel'>(option);
      if (intents.length === 1) act.send(first);
      else act.aimAt('Pick a complete set to build on', intents.map((i) => choice(targetKey('group', i.group), () => act.send(i))));
      return true;
    }
    case 'forcedDeal': {
      const intents = all<'playForcedDeal'>(option);
      const mine = [...new Set(intents.map((i) => i.myCard))];
      act.aimAt(
        'Pick one of your properties to give away',
        mine.map((my) =>
          choice(targetKey('card', my), () =>
            act.aimAt(
              'Now pick the property you want',
              intents.filter((i) => i.myCard === my).map((i) => choice(targetKey('card', i.targetCard), () => act.send(i))),
            ),
          ),
        ),
      );
      return true;
    }
    default:
      act.send(first);
      return true;
  }
}
