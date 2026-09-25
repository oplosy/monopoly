// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AudioProvider } from '../src/audio/audio-context';
import { PicnicScene } from '../src/scene/PicnicScene';
import { recordingAudio } from './audio';
import './dom';

function hideTab(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

afterEach(() => hideTab(false));

describe('the picnic ambience', () => {
  it('plays at the table while it is shown, and fades out while the tab is hidden', () => {
    const audio = recordingAudio();
    const view = render(
      <AudioProvider manager={audio}>
        <PicnicScene players={2} />
      </AudioProvider>,
    );
    expect(audio.ambience).toEqual([true]);
    hideTab(true);
    expect(audio.ambience.at(-1)).toBe(false);
    hideTab(false);
    expect(audio.ambience.at(-1)).toBe(true);
    view.unmount();
    expect(audio.ambience.at(-1)).toBe(false);
  });

  it('stays quiet behind the paper pages', () => {
    const audio = recordingAudio();
    render(
      <AudioProvider manager={audio}>
        <PicnicScene players={3} variant="backdrop" />
      </AudioProvider>,
    );
    expect(audio.ambience.filter(Boolean)).toEqual([]);
  });
});
