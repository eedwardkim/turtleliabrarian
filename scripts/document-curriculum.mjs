import { readdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const PUZZLE_DIR = 'content/puzzles';
const OUTPUT = 'CURRICULUM.md';
const KIND_ORDER = { show: 0, vary: 1, break: 2, capstone: 3 };

/**
 * Data 8 topic order per wing. The sequence is the public topic order of the
 * course; no course material is reproduced here.
 */
const TOPICS = {
  0: 'Expressions, names, calls, types, comparisons',
  1: 'Arrays and ranges',
  2: 'Tables, sorting, selecting rows',
  3: 'Visualization',
  4: 'Functions and tables',
  5: 'Joins and observational evidence',
  6: 'Randomness, iteration, probability, sampling',
  7: 'Hypothesis tests, A/B testing, causality',
  8: 'Percentiles, the bootstrap, confidence intervals',
  9: 'Mean, SD, standard units, Chebyshev, the normal curve, the CLT, sample size',
  10: 'Correlation, regression, least squares, residuals, inference',
  11: 'Classification and k-nearest neighbours',
  12: 'Updating predictions and Bayes rule',
  13: 'Integrated hazards and the Sandbox',
};

/**
 * The edge cases REQUIREMENTS.md K00–K13 name, expressed as the concept keys the
 * shelves actually author. K14 asks that each one appear in a queue together with
 * a naive counterexample; the generated coverage table reports both facts.
 */
const REQUIRED_EDGE_CASES = {
  0: [],
  1: ['exclusive_stop', 'index_out_of_range', 'length_mismatch', 'mixed_types'],
  2: ['immutable_results', 'empty_results', 'cutoff_ties', 'upper_bound', 'text_vs_number', 'messy_strings', 'missing_values'],
  3: ['counts_vs_density', 'unequal_bins', 'misleading_axes'],
  4: ['counts_vs_totals', 'zero_fill', 'simpsons_paradox'],
  5: ['unmatched_rows', 'row_multiplication', 'key_type_mismatch'],
  6: ['accumulation', 'with_replacement', 'oversampling', 'repetitions'],
  7: ['direction', 'statistic_choice', 'confounding'],
  8: ['rank_rule', 'resampling', 'sample_size'],
  9: ['standard_deviation', 'square_root_law'],
  10: ['regression_diagnostics', 'outliers', 'extrapolation'],
  11: ['feature_scaling', 'even_k', 'leakage'],
  12: ['base_rate'],
  13: ['data_cleaning'],
};

const EXPECTED_CHAPTERS = { 0: 5, ...Object.fromEntries([...Array(11)].map((_, index) => [index + 1, 6])), 12: 3, 13: 4 };

function sequence(id) {
  const digits = id.match(/\d+/g);
  return digits ? Number(digits[digits.length - 1]) : 0;
}

/** Curriculum order, identical to the sort in src/game/catalog.ts. */
function shelfOrder(puzzle) {
  return [
    puzzle.kind === 'capstone' ? Number.MAX_SAFE_INTEGER : puzzle.chapter,
    KIND_ORDER[puzzle.kind],
    sequence(puzzle.id),
    puzzle.id,
  ];
}

function byShelfOrder(left, right) {
  const a = shelfOrder(left);
  const b = shelfOrder(right);
  for (let index = 0; index < a.length; index++) {
    if (a[index] === b[index]) continue;
    return typeof a[index] === 'string' ? String(a[index]).localeCompare(String(b[index])) : a[index] - b[index];
  }
  return 0;
}

export async function loadPuzzles(directory = PUZZLE_DIR) {
  const files = (await readdir(directory)).filter((file) => file.endsWith('.json')).sort();
  const puzzles = [];
  for (const file of files) puzzles.push(JSON.parse(await readFile(`${directory}/${file}`, 'utf8')));
  const ids = new Set(puzzles.map((puzzle) => puzzle.id));
  if (ids.size !== puzzles.length) throw new Error('Duplicate request id in content/puzzles');
  return puzzles.sort(byShelfOrder);
}

function chapterLabel(chapter) {
  return chapter === 0 ? 'P' : chapter === 13 ? 'C' : String(chapter);
}

function cell(value) {
  return String(value).replaceAll('|', '\\|');
}

function table(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(cell).join(' | ')} |`),
  ].join('\n');
}

function naiveHazards(puzzle) {
  return puzzle.naive.map((naive) => naive.hazard).filter(Boolean);
}

export function buildCoverage(puzzles) {
  const chapters = [...new Set(puzzles.map((puzzle) => puzzle.chapter))].sort((a, b) => a - b);
  const concepts = new Map();
  const hazards = new Map();
  for (const puzzle of puzzles) {
    for (const concept of puzzle.concepts) {
      const entry = concepts.get(concept) ?? new Map();
      entry.set(puzzle.chapter, (entry.get(puzzle.chapter) ?? 0) + 1);
      concepts.set(concept, entry);
    }
    for (const hazard of puzzle.hazards) {
      const entry = hazards.get(hazard) ?? { puzzles: [], counterexamples: [] };
      entry.puzzles.push(puzzle.id);
      if (naiveHazards(puzzle).includes(hazard)) entry.counterexamples.push(puzzle.id);
      hazards.set(hazard, entry);
    }
  }
  const edgeCases = [];
  for (const [chapter, keys] of Object.entries(REQUIRED_EDGE_CASES)) {
    for (const key of keys) {
      const queued = puzzles.filter((puzzle) => puzzle.concepts.includes(key) || puzzle.hazards.includes(key));
      const counterexamples = queued.filter((puzzle) => puzzle.naive.length > 0);
      edgeCases.push({
        chapter: Number(chapter),
        key,
        queued: queued.map((puzzle) => puzzle.id),
        counterexamples: counterexamples.map((puzzle) => puzzle.id),
      });
    }
  }
  return { chapters, concepts, hazards, edgeCases };
}

/** Structural invariants that must hold regardless of the generated prose. */
export function auditPuzzles(puzzles) {
  const problems = [];
  const counts = {};
  for (const puzzle of puzzles) counts[puzzle.chapter] = (counts[puzzle.chapter] ?? 0) + 1;
  for (const [chapter, expected] of Object.entries(EXPECTED_CHAPTERS)) {
    if ((counts[chapter] ?? 0) !== expected) problems.push(`Chapter ${chapter} has ${counts[chapter] ?? 0} requests, expected ${expected}`);
  }
  for (const puzzle of puzzles) {
    const fixtures = new Set(puzzle.fixtures.map((fixture) => fixture.name));
    for (const hazard of puzzle.hazards) {
      if (!fixtures.has(hazard)) problems.push(`${puzzle.id} declares hazard ${hazard} with no matching fixture`);
    }
    for (const hazard of naiveHazards(puzzle)) {
      if (!fixtures.has(hazard)) problems.push(`${puzzle.id} has a naive solution aimed at unknown fixture ${hazard}`);
    }
    if (puzzle.kind === 'break' && !puzzle.naive.length) problems.push(`${puzzle.id} is a Break request with no naive counterexample`);
  }
  return problems;
}

export function renderDocument(puzzles) {
  const { chapters, concepts, hazards, edgeCases } = buildCoverage(puzzles);
  const problems = auditPuzzles(puzzles);
  const lines = [];
  lines.push('# Shelf Life curriculum coverage', '');
  lines.push('Generated by `node scripts/document-curriculum.mjs` from the authored request');
  lines.push('files in `content/puzzles`. Do not edit by hand; run the generator and commit the');
  lines.push('result. `node scripts/document-curriculum.mjs --check` fails when this file is stale.');
  lines.push('');
  lines.push(`Requests: **${puzzles.length}**. Distinct concepts: **${concepts.size}**. Distinct queue hazards: **${hazards.size}**.`);
  lines.push('');
  lines.push('Shelf Life follows the public topic order of Berkeley\'s Data 8 and implements an');
  lines.push('original `datascience`-compatible API. It is not affiliated with, endorsed by or');
  lines.push('derived from that course or the `datascience` package; see `CREDITS.md`.');
  lines.push('');

  lines.push('## Wings and topics', '');
  lines.push(table(
    ['Wing', 'Data 8 topic sequence', 'Requests', 'Show', 'Vary', 'Break', 'Capstone'],
    chapters.map((chapter) => {
      const inChapter = puzzles.filter((puzzle) => puzzle.chapter === chapter);
      const kinds = (kind) => inChapter.filter((puzzle) => puzzle.kind === kind).length;
      return [chapterLabel(chapter), TOPICS[chapter] ?? '', inChapter.length, kinds('show'), kinds('vary'), kinds('break'), kinds('capstone')];
    }),
  ));
  lines.push('');

  lines.push('## Requests in curriculum order', '');
  for (const chapter of chapters) {
    lines.push(`### Wing ${chapterLabel(chapter)} — ${TOPICS[chapter] ?? ''}`, '');
    lines.push(table(
      ['Request', 'Kind', 'Title', 'Patron', 'New API', 'Concepts', 'Queue hazards', 'Naive counterexamples'],
      puzzles.filter((puzzle) => puzzle.chapter === chapter).map((puzzle) => [
        `\`${puzzle.id}\``,
        puzzle.kind,
        puzzle.title,
        puzzle.patron,
        puzzle.requiredApi.map((api) => `\`${api}\``).join(', ') || '—',
        puzzle.concepts.join(', '),
        puzzle.hazards.join(', ') || '—',
        puzzle.naive.map((naive) => `${naive.hazard ?? 'unnamed'} (${naive.fails})`).join(', ') || '—',
      ]),
    ));
    lines.push('');
  }

  lines.push('## Concepts by wing', '');
  lines.push('Each cell counts the requests in that wing whose `concepts` list the row.', '');
  lines.push(table(
    ['Concept', ...chapters.map(chapterLabel), 'Total'],
    [...concepts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([concept, byChapter]) => [
      concept,
      ...chapters.map((chapter) => byChapter.get(chapter) ?? '·'),
      [...byChapter.values()].reduce((sum, count) => sum + count, 0),
    ]),
  ));
  lines.push('');

  lines.push('## Hazards by request', '');
  lines.push('Every hazard names a generated fixture in each listed request. The last column');
  lines.push('lists requests whose naive solution is aimed at that fixture.', '');
  lines.push(table(
    ['Hazard', 'Requests', 'Naive counterexamples'],
    [...hazards.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([hazard, entry]) => [
      hazard,
      entry.puzzles.map((id) => `\`${id}\``).join(', '),
      entry.counterexamples.map((id) => `\`${id}\``).join(', ') || '—',
    ]),
  ));
  lines.push('');

  lines.push('## Required edge cases (REQUIREMENTS K00–K14)', '');
  lines.push(table(
    ['Wing', 'Edge case', 'Requests that queue it', 'With a naive counterexample'],
    edgeCases.map((edge) => [
      chapterLabel(edge.chapter),
      edge.key,
      edge.queued.map((id) => `\`${id}\``).join(', ') || '**none**',
      edge.counterexamples.map((id) => `\`${id}\``).join(', ') || '**none**',
    ]),
  ));
  lines.push('');

  const uncovered = edgeCases.filter((edge) => !edge.counterexamples.length);
  lines.push('## Coverage gaps', '');
  if (!uncovered.length && !problems.length) {
    lines.push('None. Every required edge case is queued with at least one naive counterexample.');
  } else {
    for (const edge of uncovered) {
      lines.push(`- Wing ${chapterLabel(edge.chapter)} edge case \`${edge.key}\` is queued by ${edge.queued.map((id) => `\`${id}\``).join(', ') || 'no request'} but no request that teaches it ships a naive counterexample (REQUIREMENTS K14).`);
    }
    for (const problem of problems) lines.push(`- ${problem}`);
  }
  lines.push('');
  return `${lines.join('\n')}`;
}

export async function documentCurriculum({ check = false } = {}) {
  const puzzles = await loadPuzzles();
  const document = renderDocument(puzzles);
  if (!check) {
    await writeFile(OUTPUT, document);
    return { written: true, stale: false, puzzles: puzzles.length };
  }
  const existing = await readFile(OUTPUT, 'utf8').catch(() => '');
  return { written: false, stale: existing !== document, puzzles: puzzles.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const check = process.argv.includes('--check');
  const result = await documentCurriculum({ check });
  if (result.stale) {
    console.error(`${OUTPUT} is stale for ${result.puzzles} authored requests. Run: node scripts/document-curriculum.mjs`);
    process.exitCode = 1;
  } else {
    console.log(`${OUTPUT} ${check ? 'is current' : 'regenerated'} for ${result.puzzles} authored requests.`);
  }
}
