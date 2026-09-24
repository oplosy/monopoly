import { useRef, type ReactNode } from 'react';
import { useDialogFocus } from '../ui/useDialogFocus';
import { useAnchoredPosition } from './anchored';

interface Props {
  title: string;
  /** The card the popover belongs to. */
  anchor: Element | null;
  onClose(): void;
  children: ReactNode;
}

/** Choices attached to a card: beside it, never in a detached corner panel. */
export function Popover({ title, anchor, onClose, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, '.popover-body button');
  const place = useAnchoredPosition(anchor, ref);
  return (
    <div ref={ref} className={`popover side-${place.side}`} role="dialog" aria-label={title} style={{ left: place.left, top: place.top }}>
      <div className="popover-body">
        {children}
        <button type="button" className="popover-close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
