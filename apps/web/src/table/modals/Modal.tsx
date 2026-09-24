import { useEffect, useId, useRef, type ReactNode } from 'react';

interface Props {
  title: string;
  actions: ReactNode;
  children: ReactNode;
}

export function Modal({ title, actions, children }: Props) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Focus the first available answer so keyboard players can respond at once.
    ref.current?.querySelector<HTMLButtonElement>('.modal-actions button:not(:disabled)')?.focus();
  }, []);
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
