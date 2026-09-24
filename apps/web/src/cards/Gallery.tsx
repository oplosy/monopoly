import { CARDS, type Color } from '@deal-city/engine';
import { CardBack } from './CardBack';
import { CardFace } from './CardFace';

const WILD_STATES: { id: string; activeColor: Color }[] = [
  { id: 'wild-pink-orange-1', activeColor: 'pink' },
  { id: 'wild-pink-orange-1', activeColor: 'orange' },
  { id: 'wild-any-1', activeColor: 'red' },
  { id: 'wild-any-2', activeColor: 'darkBlue' },
];

/** Every card on one page, for visual review of the SVG art. */
export function Gallery() {
  return (
    <main className="gallery">
      <h1>Deal City card sheet</h1>
      <p>{CARDS.length} cards plus the back. Captions are card ids.</p>
      <div className="gallery-grid">
        {CARDS.map((c) => (
          <figure key={c.id}>
            <CardFace id={c.id} className="card" />
            <figcaption>{c.id}</figcaption>
          </figure>
        ))}
        <figure>
          <CardBack className="card" />
          <figcaption>back</figcaption>
        </figure>
      </div>
      <h2>Wildcards on the table</h2>
      <div className="gallery-grid">
        {WILD_STATES.map((w) => (
          <figure key={`${w.id}-${w.activeColor}`}>
            <CardFace id={w.id} activeColor={w.activeColor} className="card" />
            <figcaption>{`${w.id} as ${w.activeColor}`}</figcaption>
          </figure>
        ))}
      </div>
    </main>
  );
}
