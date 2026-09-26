// @vitest-environment jsdom
import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { memoryVoicePrefs } from '../src/voice/settings';
import { createVoiceStore } from '../src/voice/voice-store';
import { renderApp, renderTabletop } from './dom';
import { atTable, play, roomOf, savedSeat } from './fixtures';

function voiceStore() {
  return createVoiceStore({
    channel: { join: vi.fn(async () => ({ ok: true as const, iceServers: [] })), leave: vi.fn(), mic: vi.fn(), signal: vi.fn(), onSignal: vi.fn() },
    getMic: vi.fn(() => Promise.reject(new Error('no mic in tests'))),
    createPc: vi.fn(),
    play: vi.fn(),
    meter: vi.fn(),
    prefs: memoryVoicePrefs(),
  });
}

const table = () => {
  const state = atTable(play({ players: [{ id: 'p1' }, { id: 'p2' }] }), 'p1');
  state.room = { ...state.room!, seats: state.room!.seats.map((s) => (s.playerId === 'p2' ? { ...s, voice: 'talking' as const } : s)) };
  return state;
};

describe('voice at the table', () => {
  it('joins from the corner, then offers the mic and a menu to leave or switch to push-to-talk', async () => {
    const user = userEvent.setup();
    const voice = voiceStore();
    const join = vi.fn(async () => void voice.setState({ status: 'on', hasMic: true, micOn: true }));
    voice.setState({ join });
    renderTabletop({ state: table(), voice });
    await user.click(screen.getByRole('button', { name: 'Join voice' }));
    expect(join).toHaveBeenCalled();
    const mic = screen.getByRole('button', { name: 'Microphone' });
    expect(mic).toHaveAttribute('aria-pressed', 'true');
    const setMic = vi.fn();
    act(() => voice.setState({ setMic }));
    await user.click(mic);
    expect(setMic).toHaveBeenCalledWith(false);
    await user.click(screen.getByRole('button', { name: 'Voice options' }));
    const menu = screen.getByRole('group', { name: 'Voice options' });
    const setPushToTalk = vi.fn();
    const leave = vi.fn();
    act(() => voice.setState({ setPushToTalk, leave }));
    await user.click(within(menu).getByRole('checkbox', { name: 'Push-to-talk' }));
    expect(setPushToTalk).toHaveBeenCalledWith(true);
    await user.click(within(menu).getByRole('button', { name: 'Leave voice' }));
    expect(leave).toHaveBeenCalled();
  });

  it('says in words which mode the mic is in', () => {
    const voice = voiceStore();
    voice.setState({ status: 'on', hasMic: true, micOn: true });
    renderTabletop({ state: table(), voice });
    const mode = () => screen.getByTestId('voice-state');
    expect(mode()).toHaveTextContent('Mic on');
    expect(screen.getByRole('button', { name: 'Microphone' })).toHaveClass('is-live');
    act(() => voice.setState({ micOn: false }));
    expect(mode()).toHaveTextContent('Mic off');
    expect(screen.getByRole('button', { name: 'Microphone' })).toHaveClass('is-muted');
    act(() => voice.setState({ pushToTalk: true }));
    expect(mode()).toHaveTextContent('Push-to-talk: hold V');
    act(() => voice.setState({ micOn: true }));
    expect(mode()).toHaveTextContent('Talking');
    act(() => voice.setState({ hasMic: false, micOn: false, pushToTalk: false }));
    expect(mode()).toHaveTextContent('Listening only');
  });

  it('holds to talk under push-to-talk', async () => {
    const voice = voiceStore();
    const talk = vi.fn();
    voice.setState({ status: 'on', hasMic: true, pushToTalk: true, talk });
    renderTabletop({ state: table(), voice });
    const hold = screen.getByRole('button', { name: 'Hold to talk' });
    const user = userEvent.setup();
    await user.pointer({ keys: '[MouseLeft>]', target: hold });
    expect(talk).toHaveBeenLastCalledWith(true);
    await user.pointer({ keys: '[/MouseLeft]', target: hold });
    expect(talk).toHaveBeenLastCalledWith(false);
  });

  it('never opens the menu while holding to talk, and a right click never opens the mic', async () => {
    const voice = voiceStore();
    const talk = vi.fn();
    voice.setState({ status: 'on', hasMic: true, pushToTalk: true, talk });
    renderTabletop({ state: table(), voice });
    const hold = screen.getByRole('button', { name: 'Hold to talk' });
    const user = userEvent.setup();
    await user.pointer({ keys: '[MouseLeft>]', target: hold });
    await new Promise((r) => setTimeout(r, 650));
    expect(screen.queryByRole('group', { name: 'Voice options' })).toBeNull();
    await user.pointer({ keys: '[/MouseLeft]', target: hold });
    talk.mockClear();
    await user.pointer({ keys: '[MouseRight]', target: hold });
    expect(talk).not.toHaveBeenCalledWith(true);
    expect(screen.getByRole('group', { name: 'Voice options' })).toBeInTheDocument();
  });

  it('marks each seat in voice, rings whoever talks, and mutes a player for me only', async () => {
    const user = userEvent.setup();
    const voice = voiceStore();
    const mute = vi.fn();
    voice.setState({ status: 'on', talking: ['p2'], connections: { p2: 'connecting' }, mute });
    renderTabletop({ state: table(), voice });
    const bob = screen.getByRole('group', { name: /^Bob's seat/ });
    expect(bob).toHaveClass('is-talking');
    expect(within(bob).getByRole('img', { name: 'In voice' })).toBeInTheDocument();
    expect(within(bob).getByText('Connecting…')).toBeInTheDocument();
    await user.click(within(bob).getByRole('button', { name: 'Mute Bob' }));
    expect(mute).toHaveBeenCalledWith('p2', true);
    act(() => voice.setState({ connections: { p2: 'failed' }, muted: ['p2'] }));
    expect(within(bob).getByText('Could not connect')).toBeInTheDocument();
    expect(within(bob).getByRole('button', { name: 'Unmute Bob' })).toHaveAttribute('aria-pressed', 'true');
    const me = screen.getByRole('group', { name: /^Your seat/ });
    expect(within(me).queryByRole('img', { name: /In voice/ })).toBeNull(); // my server-side state is still off
  });

  it('shows a closed mic on a seat in voice with the mic off', () => {
    const voice = voiceStore();
    const state = table();
    state.room = { ...state.room!, seats: state.room!.seats.map((s) => (s.playerId === 'p2' ? { ...s, voice: 'listening' as const } : s)) };
    renderTabletop({ state, voice });
    expect(within(screen.getByRole('group', { name: /^Bob's seat/ })).getByRole('img', { name: 'In voice, mic off' })).toBeInTheDocument();
  });

  it('sets the voice volume from the settings', async () => {
    const user = userEvent.setup();
    const voice = voiceStore();
    renderTabletop({ state: table(), voice });
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const slider = screen.getByRole('slider', { name: 'Voice volume' });
    fireEvent.change(slider, { target: { value: '95' } });
    expect(voice.getState().volume).toBeCloseTo(0.95);
  });

  it('hides voice where there is none (the lab)', () => {
    renderTabletop({ state: table() });
    expect(screen.queryByRole('button', { name: 'Join voice' })).toBeNull();
  });
});

describe('voice in the lobby', () => {
  it('offers Join voice beside the chat', () => {
    const voice = voiceStore();
    renderApp('/room/ABCDEF', { state: { session: savedSeat('p1'), savedCode: 'ABCDEF', room: roomOf(['p1', 'p2'], 'lobby') }, voice });
    expect(within(screen.getByRole('region', { name: 'Chat' })).getByRole('button', { name: 'Join voice' })).toBeInTheDocument();
  });
});
