/**
 * Honest coverage assertions for a capture manifest. A tour that silently skips a
 * chapter, a request, a tutorial, a queue failure or a screenshot fails here rather
 * than producing a shorter video that still looks finished.
 */

function ids(list) {
  return list.map(entry => (typeof entry === 'object' && entry !== null ? entry.id : entry));
}

function missing(required = [], present = []) {
  const found = new Set(ids(present));
  return required.filter(entry => !found.has(entry));
}

function countByCategory(screenshots, category) {
  return screenshots.filter(shot => shot.category === category).length;
}

export function coverageGaps(manifest, requirement = {}) {
  const gaps = [];
  const coverage = manifest.coverage ?? {};
  const screenshots = manifest.screenshots ?? [];
  const captions = manifest.captions ?? [];
  if (!captions.length) gaps.push('no captions were burned into the frames');
  if (!manifest.frames) gaps.push('no frames were captured');

  const absentChapters = missing(requirement.chapters, coverage.chapters);
  if (absentChapters.length) gaps.push(`chapters never reached: ${absentChapters.join(', ')}`);

  const absentPuzzles = missing(requirement.puzzles, coverage.puzzles);
  if (absentPuzzles.length) gaps.push(`requests never solved through the real queue: ${absentPuzzles.join(', ')}`);

  for (const kind of requirement.kinds ?? []) {
    if (!(coverage.puzzles ?? []).some(entry => entry.kind === kind)) gaps.push(`no ${kind} request was played`);
  }

  const absentTutorials = missing(requirement.tutorials, coverage.tutorials);
  if (absentTutorials.length) gaps.push(`tutorials never shown: ${absentTutorials.join(', ')}`);
  if ((coverage.tutorials ?? []).length < (requirement.minTutorials ?? 0)) {
    gaps.push(`only ${(coverage.tutorials ?? []).length} tutorials were shown, ${requirement.minTutorials} required`);
  }

  const absentWindows = missing(requirement.windows, coverage.windows);
  if (absentWindows.length) gaps.push(`windows or dialogs never opened: ${absentWindows.join(', ')}`);

  if ((coverage.failures ?? []).length < (requirement.minFailures ?? 0)) {
    gaps.push(`${(coverage.failures ?? []).length} recorded queue failures, ${requirement.minFailures} required`);
  }
  if ((coverage.wings ?? []).length < (requirement.minWings ?? 0)) {
    gaps.push(`${(coverage.wings ?? []).length} wings opened, ${requirement.minWings} required`);
  }
  if ((coverage.standingOrders ?? []).length < (requirement.minStandingOrders ?? 0)) {
    gaps.push(`${(coverage.standingOrders ?? []).length} standing orders filed, ${requirement.minStandingOrders} required`);
  }

  for (const [category, minimum] of Object.entries(requirement.screenshots ?? {})) {
    const found = countByCategory(screenshots, category);
    if (found < minimum) gaps.push(`${found} ${category} screenshots, ${minimum} required`);
  }
  for (const puzzle of ids(coverage.puzzles ?? [])) {
    if (!screenshots.some(shot => shot.category === 'puzzle' && shot.id === puzzle)) gaps.push(`no screenshot for request ${puzzle}`);
  }
  for (const tutorial of ids(coverage.tutorials ?? [])) {
    if (!screenshots.some(shot => shot.category === 'tutorial' && shot.id === tutorial)) gaps.push(`no screenshot for tutorial ${tutorial}`);
  }
  for (const failure of coverage.failures ?? []) {
    const id = typeof failure === 'object' ? failure.id : failure;
    if (!screenshots.some(shot => shot.category === 'failure' && shot.id === id)) gaps.push(`no screenshot for failure ${id}`);
  }

  if (requirement.maxDurationSeconds && manifest.durationSeconds > requirement.maxDurationSeconds) {
    gaps.push(`the video runs ${manifest.durationSeconds}s, longer than the ${requirement.maxDurationSeconds}s budget`);
  }
  return gaps;
}

export function assertCoverage(manifest, requirement = {}) {
  const gaps = coverageGaps(manifest, requirement);
  if (gaps.length) throw new Error(`${manifest.tour} coverage is incomplete:\n- ${gaps.join('\n- ')}`);
  return manifest;
}
