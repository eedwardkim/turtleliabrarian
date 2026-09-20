import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
// @ts-expect-error - the release text gate is a plain Node script with no type declarations.
import { PLAYER_STRING_SOURCES, collectPlayerStrings, findUnfinishedMarkers, looksLikePlayerLabel, looksLikeProse, missingSources, spellCheck } from '../../scripts/check-release-text.mjs';

interface PlayerString { source: string; file: string; line: number; path: string; text: string }
interface Marker { marker: string; file: string; line: number; text: string }
interface Misspelling { word: string; file: string; text: string }

const collect = collectPlayerStrings as (root?: string) => PlayerString[];
const markers = findUnfinishedMarkers as (root?: string, strings?: PlayerString[]) => Marker[];
const spell = spellCheck as (strings: Pick<PlayerString, 'source' | 'file' | 'line' | 'text'>[]) => Misspelling[];
const missing = missingSources as (root?: string, strings?: PlayerString[]) => { id: string }[];
const prose = looksLikeProse as (value: unknown) => boolean;
const label = looksLikePlayerLabel as (value: unknown) => boolean;

function fixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'shelf-life-text-fixture-'));
  for (const directory of ['content/strings', 'content/puzzles', 'content/tutorials', 'content/almanac', 'src/ui', 'src/game', 'src/runtime', 'src/scene', 'engine']) {
    mkdirSync(join(root, directory), { recursive: true });
  }
  writeFileSync(join(root, 'content/strings/ui.json'), JSON.stringify({ menu: { begin: 'Open the libary' } }, null, 2));
  writeFileSync(join(root, 'content/puzzles/ch1-show-1.json'), JSON.stringify({
    id: 'ch1-show-1',
    title: 'A Cart with a Name',
    patron: 'Mr. Heron',
    request: 'Deliver the recieved catalogue of loans.',
    objective: 'Select named columns.',
    hints: ['Use select to keep two columns.', 'TODO write the second hint', 'A near-solution skeleton.'],
    starter: "shelf.wehre('pages')",
    reference: "deliver(shelf.select('title'))",
  }, null, 2));
  writeFileSync(join(root, 'content/tutorials/index.ts'), "export const tutorials = [{ steps: ['Press Run to send the script to Shelby.'] }];\n");
  writeFileSync(join(root, 'content/almanac/index.ts'), "export const almanac = [{ id: 'np.arange', explanation: 'Build evenly spaced numbers with np.arange, excluding the stop value.' }];\n");
  writeFileSync(join(root, 'src/App.tsx'), "export const App = () => <Panel />;\n");
  writeFileSync(join(root, 'src/ui/Panel.tsx'), [
    'export const Panel = () => <p className="muted">Every patron must pass before the request is complete.</p>;',
    'export const Serve = () => <button aria-label="Serve queeu" className="button primary">Serve queue</button>;',
    'export const Count = ({ n }: { n: number }) => <p>{`${n} patrons are waitng at the desk.`}</p>;',
  ].join('\n') + '\n');
  writeFileSync(join(root, 'src/game/store.ts'), "export const failure = 'No request files were found.';\n");
  writeFileSync(join(root, 'src/runtime/client.ts'), "export const busy = 'Shelby is walking in circles. Check your loop and try a smaller task.';\n");
  writeFileSync(join(root, 'src/scene/world.tsx'), "export const missingModel = 'The cart model is missing from the asset manifest.';\n");
  writeFileSync(join(root, 'engine/runtime.py'), 'MESSAGE = "Sampling more rows than the table holds needs replacement."\n');
  return root;
}

describe('release text gate', () => {
  let root: string;
  let strings: PlayerString[];

  beforeAll(() => {
    root = fixtureRoot();
    strings = collect(root);
  });

  it('visits every player-facing surface and skips code, fixtures and identifiers', () => {
    expect(missing(root, strings)).toEqual([]);
    const visited = new Set(strings.map((entry) => entry.source));
    for (const source of PLAYER_STRING_SOURCES as { id: string; requireStrings?: boolean }[]) {
      if (source.requireStrings) expect(visited).toContain(source.id);
    }
    const texts = strings.map((entry) => entry.text);
    expect(texts).toContain('Deliver the recieved catalogue of loans.');
    expect(texts).toContain('Press Run to send the script to Shelby.');
    expect(texts).toContain('Every patron must pass before the request is complete.');
    expect(texts).toContain('Sampling more rows than the table holds needs replacement.');
    expect(texts.some((text) => text.includes('wehre'))).toBe(false);
    expect(texts.some((text) => text.startsWith('deliver('))).toBe(false);
  });

  it('checks short player labels and interpolated sentences instead of skipping them', () => {
    const texts = strings.map((entry) => entry.text);
    expect(texts).toContain('Serve queue');
    expect(texts).toContain('Serve queeu');
    expect(texts.some((text) => text.includes('patrons are waitng at the desk.'))).toBe(true);
    expect(texts).not.toContain('button primary');
    expect(texts).not.toContain('muted');
  });

  it('reports a surface that stops producing player text', () => {
    const empty = strings.filter((entry) => entry.source !== 'tutorials');
    expect(missing(root, empty).map((source) => source.id)).toEqual(['tutorials']);
  });

  it('catches misspelled player writing and leaves genuine code tokens alone', () => {
    const found = spell(strings).map((finding) => finding.word);
    expect(found).toContain('recieved');
    expect(found).toContain('libary');
    expect(found).toContain('queeu');
    expect(found).toContain('waitng');
    expect(found).not.toContain('np');
    expect(found).not.toContain('arange');
    expect(found).not.toContain('Shelby');
    expect(spell([{ source: 'ui-strings', file: 'ui.json', line: 1, text: 'Pyodide loads the datascience engine; np.arange and with_columns are ready.' }])).toEqual([]);
  }, 120_000);

  it('fails on unfinished prose and dead controls without flagging real programming concepts', () => {
    const found = markers(root, strings);
    expect(found.some((finding) => finding.marker === 'todo' && finding.file.endsWith('ch1-show-1.json'))).toBe(true);

    const noisy = mkdtempSync(join(tmpdir(), 'shelf-life-text-markers-'));
    mkdirSync(join(noisy, 'src/ui'), { recursive: true });
    mkdirSync(join(noisy, 'engine'), { recursive: true });
    writeFileSync(join(noisy, 'src/ui/Legit.tsx'), [
      'export const Field = () => <input placeholder="Your librarian\'s name" onChange={commit} />;',
      'export const Link = () => <a href="/almanac">Almanac</a>;',
    ].join('\n'));
    writeFileSync(join(noisy, 'src/ui/Legit.css'), '.name-field::placeholder { color: var(--ink-placeholder); }\n');
    writeFileSync(join(noisy, 'engine/guard.py'), [
      'def minimize(f, method="Powell"):',
      '    if method not in ("Powell", "BFGS"):',
      '        raise NotImplementedError("Supported optimization methods are Powell and BFGS")',
      '    return f',
    ].join('\n'));
    expect(markers(noisy, [])).toEqual([]);

    const broken = mkdtempSync(join(tmpdir(), 'shelf-life-text-broken-'));
    mkdirSync(join(broken, 'src/ui'), { recursive: true });
    mkdirSync(join(broken, 'engine'), { recursive: true });
    writeFileSync(join(broken, 'src/ui/Dead.tsx'), [
      'export const Shop = () => <button onClick={() => {}}>Buy</button>;',
      'export const Soon = () => <p>Hatchlings are coming soon.</p>;',
      'export const Nowhere = () => <a href="#">Read more</a>;',
    ].join('\n'));
    writeFileSync(join(broken, 'engine/stub.py'), ['def percentile(values):', '    raise NotImplementedError', ''].join('\n'));
    const badMarkers = markers(broken, []).map((finding) => finding.marker);
    expect(badMarkers).toContain('dead-handler');
    expect(badMarkers).toContain('dead-link');
    expect(badMarkers).toContain('coming-soon');
    expect(badMarkers).toContain('empty-implementation');
  });

  it('treats sentences as prose and code, paths and icon data as not prose', () => {
    expect(prose('Every result lands on a fresh cart.')).toBe(true);
    expect(prose('M4 7h11M4 12h11M4 17h7m6-3 4 3-4 3')).toBe(false);
    expect(prose("deliver(shelf.select('title', 'pages'))")).toBe(false);
    expect(prose('content/puzzles/ch1-show-1.json')).toBe(false);
    expect(prose('orbit')).toBe(false);
    expect(prose('Viewing {name} on the cart')).toBe(true);
  });

  it('accepts short authored labels and still refuses identifiers and code', () => {
    expect(label('Serve queue')).toBe(true);
    expect(label('Run')).toBe(true);
    expect(label('Shop & unlocks')).toBe(true);
    expect(label('Viewing {name}')).toBe(true);
    expect(label('main.py')).toBe(false);
    expect(label('content/puzzles/ch1-show-1.json')).toBe(false);
    expect(label('() => setOpen(true)')).toBe(false);
    expect(label('')).toBe(false);
  });

  it('keeps the shipped product free of misspellings and unfinished writing', () => {
    const shipped = collect();
    expect(missingSources(undefined, shipped)).toEqual([]);
    expect(markers(undefined, shipped)).toEqual([]);
    expect(spell(shipped)).toEqual([]);
  }, 120_000);
});
