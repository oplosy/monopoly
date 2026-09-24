import { useEffect, type RefObject } from 'react';

const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])';

/**
 * Moves focus to the first match of `initial` inside the dialog and gives it back to whatever had it
 * when the dialog closes. With `trap`, Tab and Shift+Tab cycle inside the dialog.
 */
export function useDialogFocus(ref: RefObject<HTMLElement | null>, initial: string, trap = false): void {
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.querySelector<HTMLElement>(initial)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = items[0];
      const last = items.at(-1);
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    if (trap) dialog.addEventListener('keydown', onKey);
    return () => {
      dialog.removeEventListener('keydown', onKey);
      // By now the dialog may be gone from the page, which leaves focus on <body>.
      const active = document.activeElement;
      const lost = !active || active === document.body || dialog.contains(active);
      if (previous?.isConnected && lost) previous.focus();
    };
  }, [ref, initial, trap]);
}
