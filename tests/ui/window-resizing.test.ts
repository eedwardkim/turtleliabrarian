import { describe, expect, it } from 'vitest';
import { RESIZE_EDGES, resizeLayout } from '../../src/ui/helpers';

const viewport = { width: 1366, height: 768 };
const start = { x: 200, y: 200, width: 400, height: 300, z: 5, closed: false, minimized: false };

describe('window edge resizing', () => {
  for (const edge of RESIZE_EDGES) {
    it(`anchors the opposite edges while dragging ${edge}`, () => {
      const next = resizeLayout(start, edge, 20, 30, viewport);
      expect(next.x).toBe(edge.includes('w') ? 220 : 200);
      expect(next.y).toBe(edge.includes('n') ? 230 : 200);
      expect(next.x + next.width).toBe(edge.includes('e') ? 620 : 600);
      expect(next.y + next.height).toBe(edge.includes('s') ? 530 : 500);
      expect(next.z).toBe(5);
    });
    it(`clamps ${edge} at minimum size without moving the opposite edge`, () => {
      const next = resizeLayout(start, edge, edge.includes('w') ? 9999 : -9999, edge.includes('n') ? 9999 : -9999, viewport);
      expect(next.width).toBeGreaterThanOrEqual(280);
      expect(next.height).toBeGreaterThanOrEqual(140);
      if (edge.includes('w')) expect(next.x + next.width).toBe(600);
      if (edge.includes('n')) expect(next.y + next.height).toBe(500);
    });
  }
  it('stops at the desk boundaries without pushing the window across the screen', () => {
    expect(resizeLayout(start, 'nw', -9999, -9999, viewport)).toMatchObject({ x: 16, y: 86, width: 584, height: 414 });
    expect(resizeLayout(start, 'se', 9999, 9999, viewport)).toMatchObject({ x: 200, y: 200, width: 1150, height: 524 });
  });
});
