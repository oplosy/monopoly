import { useId, useRef, type ReactNode } from 'react';
import { useDialogFocus } from '../../ui/useDialogFocus';

interface Props {
  title: string;
  actions: ReactNode;
  children: ReactNode;
}

export function Modal({ title, actions, children }: Props) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  // Focus the first available answer so keyboard players can respond at once.
  useDialogFocus(ref, '.modal-actions button:not(:disabled)', true);
  return (
    <div className="modal-backdrop">
      <div ref={ref} className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId}>{title}</h2>
        {children}
        <div className="modal-actions">{actions}</div>
      </div>
    </div>
  );
}
