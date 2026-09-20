import { useId, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react';
import type { WindowLayout } from '../contracts';
import { adjustLayout, clampLayout } from './helpers';
import type { Viewport } from './helpers';
import { Icon, IconButton } from './Icon';
import { text } from './text';

interface WindowProps {
  id: string;
  title: string;
  layout: WindowLayout;
  viewport: Viewport;
  onLayout: (layout: WindowLayout) => void;
  onFocus: () => void;
  children: ReactNode;
  controls?: ReactNode;
  dark?: boolean;
  highlight?: boolean;
  scale?: number;
}

export function FloatingWindow({ id, title, layout, viewport, onLayout, onFocus, children, controls, dark = false, highlight = false, scale = 1 }: WindowProps) {
  const labelId = useId();
  const drag = useRef<{ x: number; y: number; layout: WindowLayout; resize: boolean } | null>(null);
  const [preview, setPreview] = useState<WindowLayout | null>(null);
  const current = clampLayout(preview ?? layout, viewport);

  function start(event: PointerEvent<HTMLButtonElement>, resize: boolean) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, layout: current, resize };
    onFocus();
  }

  function move(event: PointerEvent<HTMLButtonElement>) {
    const origin = drag.current;
    if (!origin) return;
    const dx = (event.clientX - origin.x) / scale;
    const dy = (event.clientY - origin.y) / scale;
    setPreview(clampLayout(origin.resize
      ? { ...origin.layout, width: origin.layout.width + dx, height: origin.layout.height + dy }
      : { ...origin.layout, x: origin.layout.x + dx, y: origin.layout.y + dy }, viewport));
  }

  function end(event: PointerEvent<HTMLButtonElement>) {
    if (!drag.current) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    onLayout({ ...current, z: layout.z });
    drag.current = null;
    setPreview(null);
  }

  function keyboard(event: KeyboardEvent<HTMLButtonElement>, resize = false) {
    if (!event.key.startsWith('Arrow')) return;
    event.preventDefault();
    onLayout(adjustLayout(current, event.key, resize || event.shiftKey, viewport));
  }

  if (layout.closed) return null;

  return <section
    className={`floating-window ${dark ? 'dark-window' : 'paper-window'} ${highlight ? 'tutorial-target' : ''} ${current.minimized ? 'minimized' : ''}`}
    aria-labelledby={labelId}
    data-window={id}
    onPointerDownCapture={onFocus}
    onFocusCapture={onFocus}
    style={{ left: current.x, top: current.y, width: current.width, height: current.minimized ? 42 : current.height, zIndex: current.z }}
  >
    <header className="window-bar">
      <button type="button" className="window-grip" aria-label={`${title}: ${text.windows.move}`} title={text.windows.move}
        onPointerDown={event => start(event, false)} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onKeyDown={keyboard}>
        <span className="grip-dots" /><span id={labelId} className="window-title">{title}</span>
      </button>
      {controls && <div className="window-actions">{controls}</div>}
      <div className="window-actions window-actions-end">
        <IconButton icon={current.minimized ? 'restore' : 'minus'} label={current.minimized ? text.windows.restore : text.windows.minimize}
          onClick={() => onLayout({ ...current, minimized: !current.minimized })} />
        <IconButton icon="close" label={`${text.windows.close}: ${title}`} onClick={() => onLayout({ ...current, closed: true })} />
      </div>
    </header>
    {!current.minimized && <>
      <div className="window-body" tabIndex={0}>{children}</div>
      <button type="button" className="window-resize" aria-label={`${title}: ${text.windows.resize}`} title={text.windows.resize}
        onPointerDown={event => start(event, true)} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onKeyDown={event => keyboard(event, true)}>
        <Icon name="resize" />
      </button>
    </>}
  </section>;
}
