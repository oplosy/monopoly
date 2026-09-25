import { CARDS, type Color } from '@deal-city/engine';
import { useState } from 'react';
import { useAmbience, useSound } from '../audio/audio-context';
import { CUE_LABEL, CUES } from '../audio/cues';
import { Avatar } from '../avatars/Avatar';
import { CHARACTERS } from '../avatars/characters';
import { DISH_ART, sceneUrl } from '../scene/art';
import { PROP_KINDS } from '../scene/geometry';
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
  const sound = useSound();
  const [ambience, setAmbience] = useState(false);
  useAmbience(ambience);
  return (
    <main className="gallery">
      <h1>Deal City card sheet</h1>
      <p>{`${CARDS.length} cards plus the back, the characters and the picnic props. Captions are ids.`}</p>
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
      <h2>Characters</h2>
      <div className="gallery-grid">
        {CHARACTERS.map((c, i) => (
          <figure key={c.name}>
            <Avatar index={i} className="card" label={c.name} />
            <figcaption>{`${i} ${c.name}`}</figcaption>
          </figure>
        ))}
      </div>
      <h2>Picnic dishes</h2>
      <div className="gallery-grid">
        {PROP_KINDS.map((kind) => (
          <figure key={kind}>
            <img className="card" src={sceneUrl(DISH_ART[kind])} alt="" />
            <figcaption>{kind}</figcaption>
          </figure>
        ))}
      </div>
      <h2>Sounds</h2>
      <p>Click a sound to hear it. The first click also switches sound on for this page.</p>
      <div role="group" aria-label="Sounds" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {CUES.map((cue) => (
          <button key={cue} type="button" onClick={() => sound(cue)}>
            {CUE_LABEL[cue]}
          </button>
        ))}
      </div>
      <p>
        <button type="button" aria-pressed={ambience} onClick={() => setAmbience((on) => !on)}>
          Ambience
        </button>
      </p>
    </main>
  );
}
