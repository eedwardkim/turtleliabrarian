import { useId, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react';
import type { WindowLayout } from '../contracts';
import { adjustLayout, clampLayout, RESIZE_EDGES, resizeLayout } from './helpers';
import type { ResizeEdge, Viewport } from './helpers';
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
  essential?: boolean;
}

export function FloatingWindow({ id, title, layout, viewport, onLayout, onFocus, children, controls, dark = false, highlight = false, scale = 1, essential = false }: WindowProps) {
  const labelId = useId();
  const drag = useRef<{ x: number; y: number; layout: WindowLayout; latest: WindowLayout; edge?: ResizeEdge } | null>(null);
  const [preview, setPreview] = useState<WindowLayout | null>(null);
  const current = clampLayout(preview ?? layout, viewport);

  function start(event: PointerEvent<HTMLButtonElement>, edge?: ResizeEdge) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, layout: current, latest: current, edge };
    onFocus();
  }

  function move(event: PointerEvent<HTMLButtonElement>) {
    const origin = drag.current;
    if (!origin) return;
    const dx = (event.clientX - origin.x) / scale;
    const dy = (event.clientY - origin.y) / scale;
    origin.latest = origin.edge
      ? resizeLayout(origin.layout, origin.edge, dx, dy, viewport)
      : clampLayout({ ...origin.layout, x: origin.layout.x + dx, y: origin.layout.y + dy }, viewport);
    setPreview(origin.latest);
  }

  function end(event: PointerEvent<HTMLButtonElement>) {
    const origin = drag.current;
    if (!origin) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    onLayout({ ...origin.latest, z: layout.z });
    setPreview(null);
  }

  function keyboard(event: KeyboardEvent<HTMLButtonElement>, edge?: ResizeEdge) {
    if (!event.key.startsWith('Arrow')) return;
    event.preventDefault();
    const dx = event.key === 'ArrowLeft' ? -16 : event.key === 'ArrowRight' ? 16 : 0;
    const dy = event.key === 'ArrowUp' ? -16 : event.key === 'ArrowDown' ? 16 : 0;
    onLayout(edge ? resizeLayout(current, edge, dx, dy, viewport) : adjustLayout(current, event.key, event.shiftKey, viewport));
  }

  if (layout.closed) return null;

  return <section
    className={`floating-window ${dark ? 'dark-window' : 'paper-window'} ${highlight ? 'tutorial-target' : ''} ${current.minimized ? 'minimized' : ''} ${controls && current.width < 400 ? 'compact-controls' : ''}`}
    aria-labelledby={labelId}
    data-window={id}
    onPointerDownCapture={onFocus}
    onFocusCapture={onFocus}
    style={{ left: current.x, top: current.y, width: current.width, height: current.minimized ? 42 : current.height, zIndex: current.z }}
  >
    <header className="window-bar">
      <button type="button" className="window-grip" aria-label={`${title}: ${text.windows.move}`} title={text.windows.move}
        onPointerDown={event => start(event)} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} onKeyDown={event => keyboard(event)}>
        <span className="grip-dots" /><span id={labelId} className="window-title">{title}</span>
      </button>
      {controls && <div className="window-actions window-controls">{controls}</div>}
      {!essential && <div className="window-actions window-actions-end">
        <IconButton icon={current.minimized ? 'restore' : 'minus'} label={current.minimized ? text.windows.restore : text.windows.minimize}
          onClick={() => onLayout({ ...current, minimized: !current.minimized })} />
        <IconButton icon="close" label={`${text.windows.close}: ${title}`} onClick={() => onLayout({ ...current, closed: true })} />
      </div>}
    </header>
    {!current.minimized && <>
      <div className="window-body" tabIndex={0}>{children}</div>
      {RESIZE_EDGES.map(edge => <button key={edge} type="button" className={`window-resize resize-${edge}`} data-resize={edge}
        aria-label={`${title}: ${text.windows.resize} (${text.windows.edges[edge]})`} title={text.windows.edges[edge]}
        onPointerDown={event => start(event, edge)} onPointerMove={move} onPointerUp={end} onPointerCancel={end}
        onLostPointerCapture={end} onKeyDown={event => keyboard(event, edge)}>
        {edge === 'se' && <Icon name="resize" />}
      </button>)}
    </>}
  </section>;
}
