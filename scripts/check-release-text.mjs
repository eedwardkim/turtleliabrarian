#!/usr/bin/env node
// Release text gates: spell-check every player-facing string and refuse unfinished writing
// or dead controls anywhere in the shipped product (X02, X11, O04).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Puzzle fields written for the player; code, identifiers and fixtures are excluded on purpose. */
export const PUZZLE_PROSE_FIELDS = ['title', 'patron', 'request', 'objective', 'hints'];

/**
 * Every surface that holds player-visible writing. `requireStrings` marks the surfaces that must
 * yield authored text; the others are scanned because a message can appear in them at any time.
 * A missing or empty directory always fails, so a renamed surface cannot silently stop being checked.
 */
export const PLAYER_STRING_SOURCES = [
  { id: 'ui-strings', dir: 'content/strings', pattern: /\.json$/, requireStrings: true },
  { id: 'puzzles', dir: 'content/puzzles', pattern: /\.json$/, requireStrings: true },
  { id: 'tutorials', dir: 'content/tutorials', pattern: /\.ts$/, requireStrings: true },
  { id: 'almanac', dir: 'content/almanac', pattern: /\.ts$/, requireStrings: true },
  { id: 'ui', dir: 'src/ui', pattern: /\.tsx?$/, requireStrings: true },
  { id: 'screens', dir: 'src', pattern: /^App\.tsx$/, shallow: true },
  { id: 'game', dir: 'src/game', pattern: /\.ts$/ },
  { id: 'runtime', dir: 'src/runtime', pattern: /\.ts$/, requireStrings: true },
  { id: 'scene', dir: 'src/scene', pattern: /\.tsx?$/ },
  { id: 'engine-messages', dir: 'engine', pattern: /\.py$/, requireStrings: true },
];

/** Shipped code and content scanned for unfinished markers; tests, docs and tooling are not shipped. */
export const SHIPPED_SOURCES = [
  { dir: 'src', pattern: /\.(ts|tsx|css)$/ },
  { dir: 'engine', pattern: /\.py$/ },
  { dir: 'content', pattern: /\.(ts|json)$/ },
  { dir: '.', pattern: /^index\.html$/, shallow: true },
];

const UNFINISHED_CODE_MARKERS = [
  { id: 'todo', pattern: /\bTODO\b/i },
  { id: 'fixme', pattern: /\bFIXME\b/i },
  { id: 'hack-marker', pattern: /\bXXX\b/ },
  { id: 'tbd', pattern: /\bTBD\b/i },
  { id: 'work-in-progress', pattern: /\bwork in progress\b/i },
  { id: 'lorem-ipsum', pattern: /\blorem ipsum\b/i },
  { id: 'coming-soon', pattern: /\bcoming soon\b/i },
  { id: 'under-construction', pattern: /\bunder construction\b/i },
  { id: 'not-implemented', pattern: /\b(not implemented yet|unimplemented)\b/i },
  { id: 'stub', pattern: /\bstubbe?d?\b/i },
  { id: 'placeholder-content', pattern: /\bplaceholder (text|copy|content|image|art|model|data)\b/i },
  { id: 'dead-handler', pattern: /\bon[A-Z]\w*=\{\s*\(\s*\)\s*=>\s*\{\s*\}\s*\}/ },
  { id: 'dead-link', pattern: /href="#"/ },
];

/**
 * An empty body that only refuses to run is a stub; a conditional `NotImplementedError` guard for an
 * unsupported argument is the documented behaviour of the API this engine reproduces.
 */
function stubBody(lines, index) {
  if (!/\braise NotImplementedError|throw new Error\(\s*['"`][^'"`]*not implemented/i.test(lines[index])) return false;
  for (let previous = index - 1; previous >= 0; previous -= 1) {
    const line = lines[previous].trim();
    if (!line || line.startsWith('#') || line.startsWith('//') || line.startsWith('*') || line.startsWith('"""')) continue;
    return /^(export )?(async )?(def |function )/.test(line) && /\)\s*(->.*)?(:|\{)$/.test(line);
  }
  return false;
}

/** Markers that only make sense as complaints about writing shown to the player. */
const UNFINISHED_PROSE_MARKERS = [
  ...UNFINISHED_CODE_MARKERS.filter(marker => !['dead-handler', 'dead-link', 'stub'].includes(marker.id)),
  { id: 'placeholder-prose', pattern: /\bplaceholder\b/i },
  { id: 'sample-copy', pattern: /\b(sample text|to be written|fill me in)\b/i },
];

/** `placeholder` is a real DOM attribute, CSS pseudo-element and custom property name. */
const MARKER_EXEMPTIONS = [
  /(^|[^\w-])placeholder\s*[=:]/i,
  /::placeholder/,
  /--[\w-]*placeholder/,
];

function listFiles(root, { dir, pattern, shallow = false }) {
  const base = join(root, dir);
  if (!existsSync(base)) return [];
  const found = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        if (!shallow && entry.name !== 'node_modules' && !entry.name.startsWith('.')) walk(full);
      } else if (pattern.test(shallow ? entry.name : full.slice(base.length + 1))) {
        found.push(full);
      }
    }
  };
  walk(base);
  return found;
}

/** `{count}` and `${name}` are interpolation slots in otherwise ordinary sentences. */
export function withoutInterpolations(value) {
  return value.replace(/\$\{[^{}]*\}/g, ' ').replace(/\{[^{}]*\}/g, ' ').replace(/\s+/g, ' ').trim();
}

function isWord(token) {
  return /^[“‘(]?[A-Za-z][A-Za-z'’-]*[.,;:!?”’)]{0,2}$/.test(token);
}

/**
 * Prose test: player writing is several real words, so code, identifiers, paths, SVG path data
 * and format keys never reach the spell checker as if they were sentences. Interpolation slots
 * are removed first, so an interpolated sentence is still checked as the sentence it is.
 */
export function looksLikeProse(value) {
  if (typeof value !== 'string') return false;
  const collapsed = withoutInterpolations(value);
  if (collapsed.length < 12 || /[{}<>|]|=>|\bfunction\b|;\s*$/.test(collapsed)) return false;
  const tokens = collapsed.split(' ');
  const words = tokens.filter(isWord);
  return words.length >= 3 && words.length / tokens.length >= 0.6 && words.some(word => word.length >= 4);
}

/**
 * Label test for text the player definitely reads: JSX text and the accessible attributes below.
 * A button reading `Serve queue` is too short for the prose test but is still authored writing,
 * so labels are accepted from one real word upwards while identifiers, paths, class lists and
 * code fragments are still refused.
 */
export function looksLikePlayerLabel(value) {
  if (typeof value !== 'string') return false;
  const collapsed = withoutInterpolations(value);
  if (!collapsed || /[{}<>|]|=>|;\s*$/.test(collapsed)) return false;
  const tokens = collapsed.split(' ');
  if (!tokens.every(token => isWord(token) || /^[&·—–-]$/.test(token) || /^\d+%?$/.test(token))) return false;
  const words = tokens.filter(isWord);
  return words.some(word => word.length >= 3);
}

/** Attributes whose values are read out or shown to the player. */
export const PLAYER_ATTRIBUTES = new Set([
  'aria-label', 'aria-description', 'aria-placeholder', 'aria-roledescription', 'aria-valuetext',
  'alt', 'label', 'placeholder', 'title',
]);

function lineOf(content, index) {
  return content.slice(0, index).split('\n').length;
}

function jsonStrings(content, keep) {
  const parsed = JSON.parse(content);
  const entries = [];
  let cursor = 0;
  const visit = (value, path) => {
    if (typeof value === 'string') {
      const index = content.indexOf(JSON.stringify(value), cursor);
      if (index >= 0) cursor = index + 1;
      if (keep(path)) entries.push({ path: path.join('.'), text: value, line: index >= 0 ? lineOf(content, index) : 1 });
    } else if (Array.isArray(value)) {
      value.forEach((item, position) => visit(item, [...path, String(position)]));
    } else if (value && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) visit(item, [...path, key]);
    }
  };
  visit(parsed, []);
  return entries;
}

function typescriptStrings(content, file) {
  const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, /\.tsx$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const entries = [];
  const labelled = new Set();
  const add = (text, node, accept = looksLikeProse) => {
    if (!accept(text)) return;
    entries.push({ path: '', text: text.replace(/\s+/g, ' ').trim(), line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1 });
  };
  /** Every literal inside a player-facing JSX attribute, including both halves of a conditional. */
  const attributeLiterals = (node, found = []) => {
    if (!node) return found;
    if (ts.isStringLiteralLike(node)) found.push(node);
    else if (ts.isTemplateExpression(node)) found.push(node.head, ...node.templateSpans.map(span => span.literal));
    else ts.forEachChild(node, child => attributeLiterals(child, found));
    return found;
  };
  const visit = (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
    if (ts.isJsxAttribute(node) && PLAYER_ATTRIBUTES.has(node.name.getText(source))) {
      for (const literal of attributeLiterals(node.initializer)) {
        labelled.add(literal);
        add(literal.text, literal, looksLikePlayerLabel);
      }
    } else if (ts.isJsxText(node)) add(node.text, node, looksLikePlayerLabel);
    else if (ts.isStringLiteralLike(node)) { if (!labelled.has(node)) add(node.text, node); }
    else if (ts.isTemplateExpression(node)) {
      for (const part of [node.head, ...node.templateSpans.map(span => span.literal)]) {
        if (!labelled.has(part)) add(part.text, part);
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(source, visit);
  return entries;
}

/** Single- and double-quoted Python literals; triple-quoted docstrings are developer notes, not player text. */
function pythonStrings(content) {
  const entries = [];
  const literal = /(?<!['"])(?:[fru]{0,2})(['"])((?:\\.|(?!\1)[^\\\n])*)\1(?!['"])/g;
  for (const match of content.matchAll(literal)) {
    const text = match[2].replace(/\\n/g, ' ').replace(/\\(.)/g, '$1');
    if (looksLikeProse(text)) entries.push({ path: '', text, line: lineOf(content, match.index) });
  }
  return entries;
}

/** Every player-facing string in the product, tagged with its source surface and location. */
export function collectPlayerStrings(root = REPO_ROOT) {
  const strings = [];
  for (const source of PLAYER_STRING_SOURCES) {
    for (const file of listFiles(root, source)) {
      const content = readFileSync(file, 'utf8');
      const where = relative(root, file);
      let entries;
      if (file.endsWith('.json') && source.id === 'puzzles') {
        entries = jsonStrings(content, path => PUZZLE_PROSE_FIELDS.includes(path[0]));
      } else if (file.endsWith('.json')) {
        entries = jsonStrings(content, () => true);
      } else if (file.endsWith('.py')) {
        entries = pythonStrings(content);
      } else {
        entries = typescriptStrings(content, file);
      }
      for (const entry of entries) {
        if (source.id === 'ui-strings' || source.id === 'puzzles' || looksLikeProse(entry.text) || looksLikePlayerLabel(entry.text)) {
          strings.push({ source: source.id, file: where, line: entry.line, path: entry.path, text: entry.text });
        }
      }
    }
  }
  return strings;
}

/** Unfinished markers and dead controls in shipped source, plus filler writing in player strings. */
export function findUnfinishedMarkers(root = REPO_ROOT, playerStrings = collectPlayerStrings(root)) {
  const findings = [];
  for (const source of SHIPPED_SOURCES) {
    for (const file of listFiles(root, source)) {
      const where = relative(root, file);
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, index) => {
        if (MARKER_EXEMPTIONS.some(exemption => exemption.test(line))) return;
        if (stubBody(lines, index)) findings.push({ marker: 'empty-implementation', file: where, line: index + 1, text: line.trim().slice(0, 120) });
        for (const marker of UNFINISHED_CODE_MARKERS) {
          if (marker.pattern.test(line)) findings.push({ marker: marker.id, file: where, line: index + 1, text: line.trim().slice(0, 120) });
        }
      });
    }
  }
  for (const entry of playerStrings) {
    for (const marker of UNFINISHED_PROSE_MARKERS) {
      if (marker.pattern.test(entry.text)) {
        findings.push({ marker: marker.id, file: entry.file, line: entry.line, text: entry.text.slice(0, 120) });
      }
    }
  }
  return findings;
}

/**
 * Spell-check the collected strings with the project cspell configuration. Strings are written to a
 * scratch document, one per line, so cspell reports map back to their authored location.
 */
export function spellCheck(playerStrings, { root = REPO_ROOT, cacheDir } = {}) {
  if (!playerStrings.length) return [];
  const directory = cacheDir ?? join(tmpdir(), `shelf-life-release-text-${process.pid}`);
  mkdirSync(directory, { recursive: true });
  const document = join(directory, 'player-strings.md');
  writeFileSync(document, `${playerStrings.map(entry => withoutInterpolations(entry.text)).join('\n')}\n`);
  const cspell = join(REPO_ROOT, 'node_modules', '.bin', 'cspell');
  const binary = existsSync(cspell) ? cspell : 'cspell';
  const result = spawnSync(binary, [
    'lint', '--no-progress', '--no-summary', '--no-color', '--language-id', 'plaintext',
    '--root', directory, '--config', join(REPO_ROOT, 'cspell.config.json'), document,
  ], { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0 && result.status !== 1) throw new Error(`cspell failed: ${result.stderr || result.stdout}`);
  const findings = [];
  for (const line of result.stdout.split('\n')) {
    const match = /:(\d+):(\d+)\s+-\s+Unknown word \((.+?)\)/.exec(line);
    if (!match) continue;
    const entry = playerStrings[Number(match[1]) - 1];
    if (entry) findings.push({ word: match[3], source: entry.source, file: entry.file, line: entry.line, text: entry.text.slice(0, 120) });
  }
  if (result.status === 1 && !findings.length) throw new Error(`cspell checked nothing: ${result.stderr || result.stdout}`);
  return findings;
}

/** Surfaces that produced no files, or no writing where writing is required. */
export function missingSources(root = REPO_ROOT, playerStrings = collectPlayerStrings(root)) {
  const surfaces = new Set(playerStrings.map(entry => entry.source));
  return PLAYER_STRING_SOURCES.filter(source =>
    !listFiles(root, source).length || (source.requireStrings && !surfaces.has(source.id)));
}

export function checkReleaseText(root = REPO_ROOT, options = {}) {
  const playerStrings = collectPlayerStrings(root);
  return {
    playerStrings,
    unfinished: findUnfinishedMarkers(root, playerStrings),
    misspellings: spellCheck(playerStrings, { root, ...options }),
    missing: missingSources(root, playerStrings),
  };
}

function main() {
  const root = REPO_ROOT;
  if (!existsSync(join(root, 'node_modules', '.bin', 'cspell'))) {
    console.error('cspell is not installed. Run npm ci first.');
    process.exitCode = 1;
    return;
  }
  const { playerStrings, unfinished, misspellings } = checkReleaseText(root);
  const surfaces = new Set(playerStrings.map(entry => entry.source));
  const missing = missingSources(root, playerStrings);
  console.log(`Player-facing strings: ${playerStrings.length} from ${surfaces.size}/${PLAYER_STRING_SOURCES.length} surfaces.`);
  for (const finding of misspellings) console.error(`spelling  ${finding.file}:${finding.line}  ${finding.word}  — ${finding.text}`);
  for (const finding of unfinished) console.error(`unfinished (${finding.marker})  ${finding.file}:${finding.line}  — ${finding.text}`);
  for (const source of missing) console.error(`missing text source: ${source.id} (${source.dir})`);
  const failures = misspellings.length + unfinished.length + missing.length;
  console.log(failures ? `Release text check FAILED with ${failures} finding(s).` : 'Release text check passed.');
  process.exitCode = failures ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) main();

export const __internal = { listFiles, jsonStrings, typescriptStrings, pythonStrings, stubBody };
