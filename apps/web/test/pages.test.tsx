// @vitest-environment jsdom
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from './dom';
import { roomOf, savedSeat } from './fixtures';

const joined = { ok: true, code: 'ABCDEF', playerId: 'p1', token: 'a'.repeat(32) };

describe('Home', () => {
  it('needs a nickname before creating or joining', async () => {
    const user = userEvent.setup();
    renderApp('/');
    expect(screen.getByRole('button', { name: 'Create a room' })).toBeDisabled();
    await user.type(screen.getByLabelText('Room code'), 'abcdef');
    expect(screen.getByRole('button', { name: 'Join' })).toBeDisabled();
    await user.type(screen.getByLabelText('Nickname'), 'Ann');
    expect(screen.getByRole('button', { name: 'Create a room' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Join' })).toBeEnabled();
  });

  it('creates a room and opens its lobby', async () => {
    const user = userEvent.setup();
    const { socket, router } = renderApp('/');
    socket.reply('room:create', () => joined);
    await user.type(screen.getByLabelText('Nickname'), 'Ann');
    await user.click(screen.getByRole('button', { name: 'Create a room' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/room/ABCDEF'));
    expect(socket.sentOf('room:create')).toEqual([{ nickname: 'Ann' }]);
  });

  it('shows join errors inline', async () => {
    const user = userEvent.setup();
    const { socket } = renderApp('/', { nickname: 'Bob' });
    socket.reply('room:join', () => ({ ok: false, error: 'roomNotFound' }));
    await user.type(screen.getByLabelText('Room code'), 'zzzzzz');
    await user.click(screen.getByRole('button', { name: 'Join' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No room with that code. Check the code and try again.');
    expect(socket.sentOf('room:join')).toEqual([{ code: 'ZZZZZZ', nickname: 'Bob' }]);
  });

  it('sends a seated player back to their room', () => {
    renderApp('/', { state: { session: savedSeat('p1') } });
    expect(screen.getByRole('link', { name: 'Back to room ABCDEF' })).toHaveAttribute('href', '/room/ABCDEF');
  });
});

describe('Room page', () => {
  it('offers a join form on a shared link', async () => {
    const user = userEvent.setup();
    const { socket } = renderApp('/room/abcdef');
    expect(screen.getByRole('heading', { name: 'ABCDEF' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Nickname'), 'Cy');
    await user.click(screen.getByRole('button', { name: 'Join room' }));
    expect(socket.sentOf('room:join')).toEqual([{ code: 'ABCDEF', nickname: 'Cy' }]);
  });

  it('says so when the shared room no longer exists', async () => {
    const user = userEvent.setup();
    const { socket } = renderApp('/room/abcdef', { nickname: 'Cy' });
    socket.reply('room:join', () => ({ ok: false, error: 'roomNotFound' }));
    await user.click(screen.getByRole('button', { name: 'Join room' }));
    expect(screen.getByRole('heading', { name: 'Room ABCDEF is closed' })).toBeInTheDocument();
    expect(screen.queryByText(/invited/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Join room' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to home' })).toBeInTheDocument();
  });

  it('rejoins a saved seat instead of asking again', () => {
    renderApp('/room/ABCDEF', { saved: savedSeat('p1'), state: { connected: false } });
    expect(screen.getByText('Rejoining your seat…')).toBeInTheDocument();
  });

  it('lets a player give up a saved seat that cannot be resumed', async () => {
    const user = userEvent.setup();
    renderApp('/room/ABCDEF', { saved: savedSeat('p1') });
    await user.click(screen.getByRole('button', { name: 'Join as a new player' }));
    expect(screen.getByRole('button', { name: 'Join room' })).toBeInTheDocument();
  });

  it('points a player with a seat elsewhere to their room', () => {
    renderApp('/room/QQQQQQ', { state: { session: savedSeat('p1') } });
    expect(screen.getByRole('link', { name: 'Go to room ABCDEF' })).toHaveAttribute('href', '/room/ABCDEF');
  });
});

describe('Lobby', () => {
  const lobby = (seats: string[], me = 'p1') =>
    renderApp('/room/ABCDEF', { state: { session: savedSeat(me), savedCode: 'ABCDEF', room: roomOf(seats, 'lobby') } });

  it('lets the host start once two players are seated', async () => {
    const user = userEvent.setup();
    const { socket, store } = lobby(['p1']);
    expect(screen.getByRole('button', { name: 'Waiting for players…' })).toBeDisabled();
    act(() => store.setState({ room: roomOf(['p1', 'p2'], 'lobby') }));
    await user.click(screen.getByRole('button', { name: 'Start game' }));
    expect(socket.sentOf('room:start')).toEqual([{}]);
  });

  it('shows the seats, the host and who is offline', () => {
    const room = roomOf(['p1', 'p2'], 'lobby');
    room.seats[0]!.connected = false;
    renderApp('/room/ABCDEF', { state: { session: savedSeat('p2'), savedCode: 'ABCDEF', room } });
    const [ann, bob] = within(screen.getByRole('list', { name: 'Players' })).getAllByRole('listitem');
    expect(ann).toHaveTextContent('Ann');
    expect(within(ann!).getByText('host')).toBeInTheDocument();
    expect(within(ann!).getByText('offline')).toBeInTheDocument();
    expect(within(bob!).getByText('you')).toBeInTheDocument();
    expect(screen.getByText('Waiting for the host to start.')).toBeInTheDocument();
  });

  it('copies the invite link', async () => {
    const user = userEvent.setup();
    lobby(['p1']);
    await user.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(await navigator.clipboard.readText()).toMatch(/\/room\/ABCDEF$/);
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });

  it('leaves the room and goes home', async () => {
    const user = userEvent.setup();
    const { socket, router } = lobby(['p1', 'p2']);
    await user.click(screen.getByRole('button', { name: 'Leave room' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(socket.sentOf('room:leave')).toEqual([{}]);
  });
});
