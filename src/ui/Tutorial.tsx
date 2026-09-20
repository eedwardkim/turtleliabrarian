import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { IconButton } from './Icon';
import { placeTutorial } from './tutorialGeometry';
import type { TutorialRect } from './tutorialGeometry';
import { text } from './text';

function rect(element: HTMLElement): TutorialRect {
  const box = element.getBoundingClientRect();
  return { x: box.x, y: box.y, width: box.width, height: box.height };
}

function sameRect(a: TutorialRect | null, b: TutorialRect | null) {
  return a === b || !!a && !!b && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

export function Tutorial({ target, title, onClose, children }: {
  target: string; title: string; onClose: () => void; children: ReactNode;
}) {
  const card = useRef<HTMLElement>(null);
  const anchor = useRef<HTMLElement | null>(null);
  const id = useId();
  const [geometry, setGeometry] = useState({
    target: null as TutorialRect | null,
    card: { width: 360, height: 220 },
    viewport: { width: window.innerWidth, height: window.innerHeight },
  });
  useLayoutEffect(() => {
    let frame: number;
    function measure() {
      const element = document.querySelector<HTMLElement>(`[data-tour="${target}"]`)
        ?? document.querySelector<HTMLElement>(`[data-window="${target}"]`);
      anchor.current = element;
      const box = element && element.getClientRects().length ? rect(element) : null;
      const size = card.current?.getBoundingClientRect();
      const width = size?.width ?? 360;
      const height = size?.height ?? 220;
      setGeometry(previous => sameRect(previous.target, box) && previous.card.width === width
        && previous.card.height === height && previous.viewport.width === window.innerWidth && previous.viewport.height === window.innerHeight
        ? previous : { target: box, card: { width, height }, viewport: { width: window.innerWidth, height: window.innerHeight } });
      frame = requestAnimationFrame(measure);
    }
    measure();
    return () => cancelAnimationFrame(frame);
  }, [target]);
  useEffect(() => {
    const previous = document.activeElement;
    card.current?.focus();
    return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, []);
  useEffect(() => {
    function key(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
    }
    function click(event: MouseEvent) {
      if (anchor.current instanceof HTMLButtonElement && event.target instanceof Node && anchor.current.contains(event.target)) onClose();
    }
    window.addEventListener('keydown', key, true);
    document.addEventListener('click', click);
    return () => { window.removeEventListener('keydown', key, true); document.removeEventListener('click', click); };
  }, [onClose]);
  const { target: box, viewport } = geometry;
  const placement = box ? placeTutorial(box, geometry.card, viewport) : null;
  const left = Math.max(0, (box?.x ?? 0) - 6);
  const top = Math.max(0, (box?.y ?? 0) - 6);
  const right = Math.min(viewport.width, (box?.x ?? 0) + (box?.width ?? 0) + 6);
  const bottom = Math.min(viewport.height, (box?.y ?? 0) + (box?.height ?? 0) + 6);
  return <div className="tutorial-layer">
    {box ? <>
      <div className="tutorial-shade" style={{ left: 0, top: 0, width: '100%', height: top }} />
      <div className="tutorial-shade" style={{ left: 0, top, width: left, height: bottom - top }} />
      <div className="tutorial-shade" style={{ left: right, top, right: 0, height: bottom - top }} />
      <div className="tutorial-shade" style={{ left: 0, top: bottom, width: '100%', bottom: 0 }} />
      <div className="tutorial-ring" style={{ left, top, width: right - left, height: bottom - top }} />
    </> : <div className="tutorial-shade" style={{ inset: 0 }} />}
    {placement && <svg className="tutorial-arrow" aria-hidden="true" width={viewport.width} height={viewport.height}>
      <defs><marker id={`${id}-arrow`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L6,3 L0,6" fill="none" stroke="#ffedb2" strokeWidth="1.5" />
      </marker></defs>
      <path d={`M${placement.from.x},${placement.from.y} L${placement.to.x},${placement.to.y}`}
        fill="none" stroke="#ffedb2" strokeWidth="3" markerEnd={`url(#${id}-arrow)`} />
    </svg>}
    <section ref={card} className="paper-dialog tutorial-dialog anchored-tutorial" role="dialog" tabIndex={-1} aria-labelledby={`${id}-title`}
      style={placement ? { left: placement.x, top: placement.y } : { left: Math.max(16, (viewport.width - geometry.card.width) / 2), top: 90 }}>
      <div className="dialog-header"><h2 id={`${id}-title`}>{title}</h2><IconButton icon="close" label={text.menu.close} onClick={onClose} /></div>
      <div className="dialog-content">{children}</div>
    </section>
  </div>;
}
