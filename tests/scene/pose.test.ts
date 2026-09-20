import { describe, expect, it } from 'vitest';
import type { AnimationSpec } from '../../src/scene/director';
import { SHELBY_HOME, shelbyPose, WALK_FRACTION } from '../../src/scene/director';

const spec = (motion: AnimationSpec['motion'], clip = 'think'): AnimationSpec => ({ motion, clip, duration: 1.4 });

describe('shelbyPose', () => {
  it('keeps Shelby home for desk motions like inspect', () => {
    const pose = shelbyPose(spec('inspect'), 0.5);
    expect(pose.position).toEqual(SHELBY_HOME);
    expect(pose.clip).toBe('think');
    expect(pose.clipProgress).toBe(0.5);
  });

  it('walks to the stamp station, then plays the station clip remapped', () => {
    const stamping = spec('stamp', 'stamp');
    const walking = shelbyPose(stamping, 0.2);
    expect(walking.clip).toBe('walk');
    expect(walking.position[0]).toBeGreaterThan(-1.3);
    const arrived = shelbyPose(stamping, WALK_FRACTION);
    expect(arrived.clip).toBe('stamp');
    expect(arrived.position).toEqual([-1.3, 1.98, 0.85]);
    expect(arrived.clipProgress).toBe(0);
    const mid = shelbyPose(stamping, 0.675);
    expect(mid.clipProgress).toBeCloseTo(0.5);
    expect(mid.position).toEqual([-1.3, 1.98, 0.85]);
  });

  it('stations stack motions at the shelves', () => {
    for (const motion of ['create', 'reshuffle', 'tray', 'bins', 'drawers', 'sample'] as const) {
      expect(shelbyPose(spec(motion), 1).position).toEqual([-0.9, 1.98, -1.0]);
    }
    expect(shelbyPose(spec('sieve'), 1).position).toEqual([0.3, 1.98, -0.25]);
  });

  it('skips the walk under reduced motion', () => {
    const pose = shelbyPose(spec('stamp', 'stamp'), 0.1, true);
    expect(pose.clip).toBe('stamp');
    expect(pose.position).toEqual([-1.3, 1.98, 0.85]);
  });

  it('keeps the trip sway and deliver sweep', () => {
    expect(shelbyPose(spec('trip', 'walk'), 0.25).position[0]).toBeCloseTo(0.7);
    expect(shelbyPose(spec('deliver', 'deliver'), 0.5).position[0]).toBeCloseTo(0.55);
  });
});
