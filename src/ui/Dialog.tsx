import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { IconButton } from './Icon';
import { text } from './text';

export function Dialog({ title, onClose, children, className = '', modal = true }: { title: string; onClose: () => void; children: ReactNode; className?: string; modal?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    if (modal) dialog?.showModal();
    else dialog?.show();
    return () => {
      dialog?.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [modal]);
  return <dialog ref={ref} className={`paper-dialog ${className}`} aria-labelledby={headingId}
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="dialog-header"><h2 id={headingId}>{title}</h2><IconButton icon="close" label={text.menu.close} onClick={onClose} /></div>
    <div className="dialog-content">{children}</div>
  </dialog>;
}
