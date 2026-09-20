import { describe, expect, it } from 'vitest';
import { placeTutorial } from '../../src/ui/tutorialGeometry';

describe('tutorial placement', () => {
  for (const scale of [0.8, 1, 1.25]) {
    it(`keeps the top toolbar target uncovered at ${scale} scale`, () => {
      const target = { x: 1150 * scale, y: 24 * scale, width: 35 * scale, height: 34 * scale };
      const viewport = { width: 1600, height: 900 };
      const card = { width: 360, height: 240 };
      const result = placeTutorial(target, card, viewport);
      expect(result.side).toBe('below');
      expect(result.y).toBeGreaterThan(target.y + target.height);
      expect(result.y).toBeLessThan(130);
      expect(result.x + card.width).toBeLessThanOrEqual(viewport.width - 16);
      expect(result.to.x).toBe(target.x + target.width / 2);
      expect(result.to.y).toBe(target.y + target.height + 8);
    });
  }
  it('moves beside a tall window rather than covering it', () => {
    const target = { x: 920, y: 100, width: 350, height: 580 };
    const result = placeTutorial(target, { width: 360, height: 240 }, { width: 1280, height: 800 });
    expect(result.side).toBe('left');
    expect(result.x + 360).toBeLessThan(target.x);
  });
  it('moves above a button near the bottom of the screen', () => {
    const target = { x: 480, y: 680, width: 80, height: 40 };
    const result = placeTutorial(target, { width: 450, height: 240 }, { width: 1024, height: 768 });
    expect(result.side).toBe('above');
    expect(result.y + 240).toBeLessThan(target.y);
  });
});
