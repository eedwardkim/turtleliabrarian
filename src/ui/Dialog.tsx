import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { IconButton } from './Icon';
import { text } from './text';

export function Dialog({ title, onClose, children, className = '' }: { title: string; onClose: () => void; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);
  return <dialog ref={ref} className={`paper-dialog ${className}`} aria-labelledby={headingId}
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="dialog-header"><h2 id={headingId}>{title}</h2><IconButton icon="close" label={text.menu.close} onClick={onClose} /></div>
    <div className="dialog-content">{children}</div>
  </dialog>;
}
