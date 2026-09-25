// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AudioProvider } from '../src/audio/audio-context';
import { createAudioManager } from '../src/audio/manager';
import { SoundControl } from '../src/audio/SoundControl';
import { Gallery } from '../src/cards/Gallery';
import { fakeAudioDeps, recordingAudio } from './audio';
import { renderTabletop } from './dom';
import { atTable, play } from './fixtures';

function control() {
  const f = fakeAudioDeps();
  render(
    <AudioProvider manager={createAudioManager(f.deps)}>
      <SoundControl />
    </AudioProvider>,
  );
  return f;
}

describe('the sound control', () => {
  it('turns sound off and on, and remembers it', () => {
    const { settings } = control();
    const toggle = screen.getByRole('button', { name: 'Sound' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(settings.saved.at(-1)).toEqual({ volume: 0.6, muted: true });
  });

  it('sets the volume, and sliding it up turns sound back on', () => {
    const { settings } = control();
    fireEvent.click(screen.getByRole('button', { name: 'Sound' }));
    fireEvent.change(screen.getByRole('slider', { name: 'Volume' }), { target: { value: '30' } });
    expect(settings.saved.at(-1)).toEqual({ volume: 0.3, muted: false });
    const slider = screen.getByRole<HTMLInputElement>('slider', { name: 'Volume' });
    expect(slider.value).toBe('30');
    expect(slider).toHaveAttribute('aria-valuetext', '30%');
    expect(screen.getByRole('button', { name: 'Sound' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows sound as off at volume 0, and one press brings it back', () => {
    const { settings } = control();
    fireEvent.change(screen.getByRole('slider', { name: 'Volume' }), { target: { value: '0' } });
    const toggle = screen.getByRole('button', { name: 'Sound' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(toggle);
    expect(settings.saved.at(-1)).toEqual({ volume: 0.6, muted: false });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });

  it('switches sound on at the first touch or key anywhere on the page, once', () => {
    const { createContext } = control();
    expect(createContext).not.toHaveBeenCalled();
    fireEvent.pointerDown(document.body);
    fireEvent.keyDown(document.body, { key: 'a' });
    expect(createContext).toHaveBeenCalledTimes(1);
  });

  it('switches sound on when a finger lifts: browsers count a touch as a gesture only then', () => {
    for (const lift of [(el: Element) => fireEvent.pointerUp(el, { pointerType: 'touch' }), (el: Element) => fireEvent.touchEnd(el)]) {
      const { createContext } = control();
      lift(document.body);
      expect(createContext).toHaveBeenCalledTimes(1);
      cleanup();
    }
  });

  it('sits in the game menu at the table', () => {
    renderTabletop({ state: atTable(play({ players: [{ id: 'p1' }, { id: 'p2' }] }), 'p1') });
    const menu = screen.getByRole('navigation', { name: 'Game menu' });
    expect(within(menu).getByRole('button', { name: 'Sound' })).toBeInTheDocument();
    expect(within(menu).getByRole('slider', { name: 'Volume' })).toBeInTheDocument();
  });
});

describe('the sound board', () => {
  it('plays every cue from the card sheet', () => {
    const audio = recordingAudio();
    render(
      <AudioProvider manager={audio}>
        <Gallery />
      </AudioProvider>,
    );
    const board = screen.getByRole('group', { name: 'Sounds' });
    expect(within(board).getAllByRole('button')).toHaveLength(14);
    fireEvent.click(within(board).getByRole('button', { name: 'My turn' }));
    expect(audio.played).toEqual(['turn']);
  });
});
