// @vitest-environment jsdom
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { socketChannel } from '../src/voice/channel';
import { usePushToTalk, VoiceProvider } from '../src/voice/context';
import { memoryVoicePrefs } from '../src/voice/settings';
import { createVoiceStore } from '../src/voice/voice-store';
import { FakeSocket } from './fake-socket';
import './dom';

describe('socketChannel', () => {
  it('speaks the voice events over the game socket', async () => {
    const socket = new FakeSocket();
    socket.reply('voice:join', () => ({ ok: true, iceServers: [] }));
    const channel = socketChannel(socket);
    expect(await channel.join()).toEqual({ ok: true, iceServers: [] });
    channel.mic(true);
    channel.signal('p2', { candidate: null });
    channel.leave();
    expect(socket.sentOf('voice:mic')).toEqual([{ on: true }]);
    expect(socket.sentOf('voice:signal')).toEqual([{ to: 'p2', data: { candidate: null } }]);
    expect(socket.sentOf('voice:leave')).toEqual([{}]);
    const heard = vi.fn();
    channel.onSignal(heard);
    socket.push('voice:signal', { from: 'p2', data: { candidate: null } });
    expect(heard).toHaveBeenCalledWith('p2', { candidate: null });
  });

  it('turns a timed-out join into a refusal', async () => {
    const socket = new FakeSocket();
    socket.reply('voice:join', () => Promise.reject(new Error('operation has timed out')));
    expect(await socketChannel(socket).join()).toEqual({ ok: false, error: 'timeout' });
  });
});

describe('usePushToTalk', () => {
  function Harness() {
    usePushToTalk();
    return <input aria-label="Message" />;
  }

  it('holds the mic open while V is held, but not while typing in a text field', async () => {
    const store = createVoiceStore({
      channel: { join: vi.fn(), leave: vi.fn(), mic: vi.fn(), signal: vi.fn(), onSignal: vi.fn() },
      getMic: vi.fn(),
      createPc: vi.fn(),
      play: vi.fn(),
      meter: vi.fn(),
      prefs: memoryVoicePrefs(),
    });
    const talk = vi.fn();
    store.setState({ status: 'on', pushToTalk: true, talk });
    const user = userEvent.setup();
    const { getByRole } = render(
      <VoiceProvider store={store}>
        <Harness />
      </VoiceProvider>,
    );
    await user.keyboard('{v>}');
    expect(talk).toHaveBeenLastCalledWith(true);
    await user.keyboard('{/v}');
    expect(talk).toHaveBeenLastCalledWith(false);
    talk.mockClear();
    await user.click(getByRole('textbox', { name: 'Message' }));
    await user.keyboard('{v>}');
    expect(talk).not.toHaveBeenCalledWith(true);
    expect(getByRole('textbox', { name: 'Message' })).toHaveValue('v');
    await user.keyboard('{/v}');
  });
});
