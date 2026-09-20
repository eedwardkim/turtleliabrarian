import { describe, expect, it } from 'vitest';
import type { TableValue, TraceEvent } from '../../src/contracts';
import { getPuzzle, puzzles } from '../../src/game/catalog';
import { canEnterPuzzle } from '../../src/game/economy';
import { freshSave } from '../../src/game/saves';
import { blankAnswer } from '../../content/tutorials/demo';
import { bookcaseFrame } from '../../src/scene/bookcaseFrame';

const source: TableValue = {
  kind: 'table', labels: ['title', 'height'], rows: [['Tall', 28], ['Short', 10], ['Medium', 18]], totalRows: 3,
};
const sorted: TableValue = { ...source, rows: [source.rows[1], source.rows[2], source.rows[0]] };
function sortEvent(value = sorted, seq = 1): TraceEvent {
  return { version: 1, seq, type: 'sort', line: 1, inputs: ['books'], output: `sorted-${seq}`,
    payload: { inputValues: [{ ...source }], value: { ...value } } };
}
const order = (books: ReturnType<typeof bookcaseFrame>) => [...books].sort((a, b) => a.x - b.x).map(book => book.height);

describe('bookcase lesson', () => {
  it('is the very next playable request after the first range, with one clickable blank', () => {
    const index = puzzles.findIndex(puzzle => puzzle.id === 'ch1-show-2');
    const lesson = getPuzzle('ch1-show-3');
    expect(puzzles[index + 1]).toBe(lesson);
    expect(puzzles[index + 2].id).toBe('ch1-vary-1');
    expect(canEnterPuzzle({ ...freshSave(), completed: ['ch1-show-2'] }, lesson)).toBe(true);
    expect(lesson.lesson).toBe(true);
    expect(lesson.reference).toBe("books.sort('height')");
    expect(blankAnswer(lesson.starter, lesson.reference)).toBe("'height'");
  });

  it('starts with disordered, leaning books and does not change before the sort event', () => {
    const event = sortEvent();
    const books = bookcaseFrame(source, [event], null, 1);
    expect(order(books)).toEqual([28, 10, 18]);
    expect(books.every(book => book.lean !== 0 && book.lift === 0)).toBe(true);
    expect(bookcaseFrame(source, [event], event, 0)).toEqual(books);
  });

  it('moves the same books through the air to the Python output order, then settles upright', () => {
    const event = sortEvent();
    const middle = bookcaseFrame(source, [event], event, 0.6);
    const final = bookcaseFrame(source, [event], event, 1);
    expect(middle.every(book => book.lift > 0 && book.depth > 0)).toBe(true);
    expect(order(final)).toEqual([10, 18, 28]);
    expect(final.map(book => [book.id, book.title, book.height])).toEqual([[0, 'Tall', 28], [1, 'Short', 10], [2, 'Medium', 18]]);
    expect(final.every(book => book.lean === 0 && book.lift === 0 && book.depth === 0)).toBe(true);
  });

  it('shows an incorrect sort honestly and preserves the final shelf through later trace events', () => {
    const wrong = { ...source, rows: [source.rows[2], source.rows[1], source.rows[0]] };
    const event = sortEvent(wrong);
    const later: TraceEvent = { ...event, seq: 2, type: 'bind' };
    expect(order(bookcaseFrame(source, [event, later], later, 0))).toEqual([18, 10, 28]);
    expect(order(bookcaseFrame(source, [event], event, 0.5, true))).toEqual([18, 10, 28]);
  });

  it('keeps unrelated sorts from changing the bookcase and supports saved completion', () => {
    const unrelated = sortEvent({ ...source, rows: [['Other', 1]], totalRows: 1 });
    expect(order(bookcaseFrame(source, [unrelated], unrelated, 1))).toEqual([28, 10, 18]);
    expect(order(bookcaseFrame(source, [], null, 0, false, sorted))).toEqual([10, 18, 28]);
  });

  it('replays successive sorts from the current arrangement and restarts a new run disheveled', () => {
    const first = sortEvent();
    const second = sortEvent(source, 2);
    expect(order(bookcaseFrame(source, [first, second], second, 0))).toEqual([10, 18, 28]);
    expect(order(bookcaseFrame(source, [first, second], second, 1))).toEqual([28, 10, 18]);
    expect(order(bookcaseFrame(source, [first], null, 0))).toEqual([28, 10, 18]);
  });
});
