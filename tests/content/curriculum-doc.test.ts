import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
// @ts-expect-error - plain ESM generator script without type declarations
import { auditPuzzles, buildCoverage, loadPuzzles, renderDocument } from '../../scripts/document-curriculum.mjs';
import { puzzles } from '../../src/game/catalog';

const authored = await loadPuzzles();

describe('curriculum document generator', () => {
  it('reads every authored request in the same order as the shipped catalog', () => {
    expect(authored).toHaveLength(78);
    expect(authored.map((puzzle: { id: string }) => puzzle.id)).toEqual(puzzles.map((puzzle) => puzzle.id));
  });

  it('keeps every declared hazard backed by a fixture and every Break counterexampled', () => {
    expect(auditPuzzles(authored)).toEqual([]);
  });

  it('covers concepts and hazards from the authored files rather than a fixed list', () => {
    const { concepts, hazards, edgeCases } = buildCoverage(authored);
    const declared = new Set(authored.flatMap((puzzle: { concepts: string[] }) => puzzle.concepts));
    expect(concepts.size).toBe(declared.size);
    expect(hazards.size).toBeGreaterThan(0);
    for (const edge of edgeCases) expect(edge.queued.length, `edge case ${edge.key} is never queued`).toBeGreaterThan(0);
  });

  it('matches the committed CURRICULUM.md', async () => {
    expect(await readFile('CURRICULUM.md', 'utf8')).toBe(renderDocument(authored));
  });
});
