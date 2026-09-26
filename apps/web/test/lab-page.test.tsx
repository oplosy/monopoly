// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Lab } from '../src/lab/Lab';
import './dom';

afterEach(() => vi.useRealTimers());

describe('the animation lab', () => {
  it('sets its table under StrictMode, whose extra unmount and mount must not lose the connection', async () => {
    vi.useFakeTimers();
    const router = createMemoryRouter([{ path: '/lab', element: <Lab /> }], { initialEntries: ['/lab?s=turn'] });
    render(
      <StrictMode>
        <RouterProvider router={router} />
      </StrictMode>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(screen.queryByText('Setting the table…')).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: /^Your hand/ })).toBeInTheDocument();
  });
});
