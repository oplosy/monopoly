export interface Signals {
  once(signal: 'SIGTERM' | 'SIGINT', listener: () => void): unknown;
}

/**
 * Closes the server once on SIGTERM (docker stop) or SIGINT (Ctrl+C), then exits.
 * Node as a container's PID 1 would otherwise ignore SIGTERM until Docker kills it.
 */
export function closeOnSignals(close: () => Promise<void>, exit: (code: number) => void, signals: Signals = process): void {
  let closing = false;
  const onSignal = () => {
    if (closing) return;
    closing = true;
    close().then(
      () => exit(0),
      (err: unknown) => {
        console.error('Shutdown failed', err);
        exit(1);
      },
    );
  };
  signals.once('SIGTERM', onSignal);
  signals.once('SIGINT', onSignal);
}
