import type { Viewport } from './helpers';

export interface TutorialRect extends Viewport { x: number; y: number }
export type TutorialSide = 'below' | 'above' | 'left' | 'right';

export function placeTutorial(target: TutorialRect, card: Viewport, viewport: Viewport) {
  const gap = 44;
  const inset = 16;
  const clampX = (x: number) => Math.max(inset, Math.min(x, viewport.width - card.width - inset));
  const clampY = (y: number) => Math.max(inset, Math.min(y, viewport.height - card.height - inset));
  const middleX = target.x + target.width / 2;
  const middleY = target.y + target.height / 2;
  const candidates: { x: number; y: number; side: TutorialSide }[] = [
    { x: clampX(middleX - card.width / 2), y: target.y + target.height + gap, side: 'below' },
    { x: target.x + target.width + gap, y: clampY(middleY - card.height / 2), side: 'right' },
    { x: target.x - card.width - gap, y: clampY(middleY - card.height / 2), side: 'left' },
    { x: clampX(middleX - card.width / 2), y: target.y - card.height - gap, side: 'above' },
  ];
  const placement = candidates.find(({ x, y }) => x >= inset && y >= inset
    && x + card.width <= viewport.width - inset && y + card.height <= viewport.height - inset)
    ?? { ...candidates[0], y: clampY(candidates[0].y) };
  const { x, y, side } = placement;
  const horizontal = side === 'left' || side === 'right';
  const from = horizontal
    ? { x: side === 'left' ? x + card.width : x, y: Math.max(y + 20, Math.min(middleY, y + card.height - 20)) }
    : { x: Math.max(x + 20, Math.min(middleX, x + card.width - 20)), y: side === 'above' ? y + card.height : y };
  const to = horizontal
    ? { x: side === 'left' ? target.x - 8 : target.x + target.width + 8, y: middleY }
    : { x: middleX, y: side === 'above' ? target.y - 8 : target.y + target.height + 8 };
  return { ...placement, from, to };
}
