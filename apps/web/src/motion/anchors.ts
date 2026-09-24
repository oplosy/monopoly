import { poseOf, type Pose } from './pose';

/**
 * Where every visual thing on the table is: cards (`card:<id>`), hands (`hand:<player>`), banks
 * (`bank:<player>`), areas (`tableau:<player>`), groups (`group:<id>`), seats (`seat:<player>`), the
 * `deck`, the `discard` pile, the table `center` and the winner's banner cards (`win:<id>`).
 * The newest element registered under a key holds it. Each key keeps its last pose and element
 * after it leaves the page, so a flight can start where a card was and a leaving seat can be drawn
 * once more.
 */
export class AnchorRegistry {
  private readonly mounted = new Map<string, HTMLElement[]>();
  private readonly lastPose = new Map<string, Pose>();
  private readonly lastElement = new Map<string, HTMLElement>();

  set(key: string, el: HTMLElement): void {
    this.mounted.set(key, [...(this.mounted.get(key) ?? []).filter((x) => x !== el), el]);
    this.lastElement.set(key, el);
  }

  unset(key: string, el: HTMLElement): void {
    const rest = (this.mounted.get(key) ?? []).filter((x) => x !== el);
    if (rest.length > 0) this.mounted.set(key, rest);
    else this.mounted.delete(key);
  }

  /** Measures everything on the page; keys that left keep the pose they had when last measured. */
  snapshot(): Map<string, Pose> {
    for (const [key, els] of this.mounted) this.lastPose.set(key, poseOf(els.at(-1)!));
    return new Map(this.lastPose);
  }

  /** The live pose of the first key that is on the page, or null. */
  measure(keys: readonly string[]): Pose | null {
    for (const key of keys) {
      const el = this.element(key);
      if (el) return poseOf(el);
    }
    return null;
  }

  element(key: string): HTMLElement | null {
    return this.mounted.get(key)?.at(-1) ?? null;
  }

  /** The element last registered under `key`, even after it left the page. */
  last(key: string): HTMLElement | null {
    return this.lastElement.get(key) ?? null;
  }

  /** Keys on the page that start with `prefix`, with the element holding each. */
  entries(prefix: string): [string, HTMLElement][] {
    return [...this.mounted].filter(([key]) => key.startsWith(prefix)).map(([key, els]) => [key, els.at(-1)!]);
  }
}
