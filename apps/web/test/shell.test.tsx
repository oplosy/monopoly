// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from './dom';
import { atTable, play, savedSeat } from './fixtures';

describe('shell', () => {
  it('shows a banner while the socket is down', () => {
    renderApp('/', { state: { connected: false } });
    expect(screen.getByRole('status')).toHaveTextContent('Connecting to the server…');
  });

  it('hands the seat back to this tab after it was replaced', async () => {
    const user = userEvent.setup();
    const { socket } = renderApp('/room/ABCDEF', { saved: savedSeat('p1'), state: { replaced: true } });
    socket.reply('room:resume', () => ({ ok: true, ...savedSeat('p1') }));
    expect(screen.getByRole('heading', { name: 'Opened in another tab' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Use this tab instead' }));
    expect(socket.sentOf('room:resume')).toEqual([{ token: 'a'.repeat(32) }]);
    expect(await screen.findByText('Loading the room…')).toBeInTheDocument();
  });

  it('shows errors as a dismissable toast', async () => {
    const user = userEvent.setup();
    renderApp('/', { state: { error: 'noPlaysLeft' } });
    expect(screen.getByRole('alert')).toHaveTextContent('You have no plays left this turn.');
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('game over', () => {
  const won = () =>
    play(
      {
        players: [
          {
            id: 'p1',
            hand: ['prop-green-3'],
            groups: [
              { color: 'brown', cards: ['prop-brown-1', 'prop-brown-2'] },
              { color: 'darkBlue', cards: ['prop-darkBlue-1', 'prop-darkBlue-2'] },
              { color: 'green', cards: ['prop-green-1', 'prop-green-2'] },
            ],
          },
          { id: 'p2' },
        ],
      },
      [['p1', { type: 'playProperty', card: 'prop-green-3', color: 'green' }]],
    );

  it('celebrates the winner and lets the host start a rematch', async () => {
    const user = userEvent.setup();
    const { socket } = renderApp('/room/ABCDEF', { state: atTable(won(), 'p1', { status: 'finished' }) });
    const dialog = screen.getByRole('dialog', { name: 'You win!' });
    expect(within(dialog).getAllByRole('img')).toHaveLength(7);
    await user.click(within(dialog).getByRole('button', { name: 'Play again' }));
    expect(socket.sentOf('room:rematch')).toEqual([{}]);
  });

  it('lets the other players leave', async () => {
    const user = userEvent.setup();
    const { socket, router } = renderApp('/room/ABCDEF', { state: atTable(won(), 'p2', { status: 'finished' }) });
    const dialog = screen.getByRole('dialog', { name: 'Ann wins!' });
    expect(within(dialog).getByText('Waiting for the host to start a rematch.')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Leave' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(socket.sentOf('room:leave')).toEqual([{}]);
  });
});
