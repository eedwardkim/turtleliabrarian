export interface Tutorial {
  id: string;
  title: string;
  target: string;
  trigger: string;
  steps: string[];
}

export const tutorials: Tutorial[] = [
  { id: 'request', title: 'A slip, a shelf, a librarian', target: 'request', trigger: 'new-game', steps: ['Read the patron’s request. The named inputs are already waiting in Python.', 'Your script must send the requested value with deliver. I shall handle the paperwork.'] },
  { id: 'run', title: 'Let Shelby try it', target: 'run', trigger: 'new-game', steps: ['Edit the script, then press Run or Control/Command + Enter.', 'Run checks this shelf. You can try again without spending resources.'] },
  { id: 'ghost', title: 'A pale blue possibility', target: 'request', trigger: 'preview', steps: ['The ghost preview shows the requested result for this shelf.', 'Compare its shape and labels with your result. A ghost is a guide, not a script.'] },
  { id: 'output', title: 'Read the receipt', target: 'output', trigger: 'run', steps: ['Printed text and the last expression appear here.', 'Only the value passed to deliver answers the patron’s request.'] },
  { id: 'queue', title: 'The other patrons', target: 'queue', trigger: 'run-pass', steps: ['Serve Queue runs the same script on several different shelves.', 'Every patron must pass. Select a failed patron to inspect that exact shelf.'] },
  { id: 'loud', title: 'A small tumble', target: 'output', trigger: 'loud', steps: ['An exception stopped the script. The error card points to the player line.', 'Read the plain-language note, repair the code, and run again. Shelby is quite resilient.'] },
  { id: 'silent', title: 'The Auditor arrives', target: 'output', trigger: 'silent', steps: ['The script ran, but the delivered result differs from the request.', 'Red marks show wrong or extra values; ghosts show what is missing. Check labels and order too.'] },
  { id: 'almanac', title: 'Notes in the margin', target: 'almanac', trigger: 'complete', steps: ['The Almanac keeps signatures, small examples, and outputs for learned tools.', 'Pitfalls appear after their lesson. You may replay these tutorials from here.'] },
  { id: 'hints', title: 'A discreet nudge', target: 'hints', trigger: 'hint', steps: ['Hints grow from a nudge to a tool to a skeleton.', 'Use as many as you need. Required learning and rewards remain available.'] },
  { id: 'scratch', title: 'The blotting paper', target: 'scratch', trigger: 'scratch', steps: ['Try a short expression using the current inputs.', 'Scratch work does not replace your script or complete a request.'] },
  { id: 'imports', title: 'One script can help another', target: 'files', trigger: 'add-file', steps: ['A helper.py script can hold reusable Python names.', 'Import helper from another script; saved files travel with your save. Do not give helpers the name of a built-in library.'] },
  { id: 'replay', title: 'Watch the work', target: 'replay', trigger: 'run', steps: ['Pause, step, or scrub through the recorded operations.', 'Replay speed changes the animation, never the Python answer.'] },
  { id: 'resources', title: 'A well-kept ledger', target: 'resources', trigger: 'complete', steps: ['Served patrons earn Ink; completing requests earns Gold Stars.', 'Core lessons are always affordable. Extras are conveniences, not homework fees.'] },
  { id: 'shop', title: 'Brass and small luxuries', target: 'shop', trigger: 'complete', steps: ['Ink buys script capacity, faster replay, standing-order slots, and hats.', 'Only purchases you can afford leave the shelf.'] },
  { id: 'wings', title: 'Room to grow', target: 'request', trigger: 'chapter', steps: ['Finish the previous wing’s requests to open the next lessons.', 'The core API arrives with its lesson. You never need to wait for idle earnings.'] },
  { id: 'standing', title: 'A reliable routine', target: 'standing-orders', trigger: 'complete', steps: ['File a script only after it has passed the full queue.', 'Standing orders run on fresh shelves. A failure pauses that order and keeps its shelf for inspection.'] },
  { id: 'saves', title: 'Keep the ledger dry', target: 'saves', trigger: 'save', steps: ['Meaningful changes autosave locally. There are three separate slots.', 'Export a JSON copy for another computer. If a snapshot is damaged, the last good one can be recovered.'] },
  { id: 'settings', title: 'Make yourself comfortable', target: 'settings', trigger: 'settings', steps: ['Adjust volume, text size, scale, motion, and color patterns here.', 'Open Stacks exposes the API for experienced readers; it does not solve requests.'] },
  { id: 'hatchlings', title: 'Small spectacles', target: 'shop', trigger: 'hatch', steps: ['An earned Egg can hatch a helper, up to four.', 'Helpers speed standing-order trips; the player’s run always goes first.'] },
  { id: 'hazard-fractions', title: 'Do not lose the crumbs', target: 'request', trigger: 'fractional_share', steps: ['Some shares are fractional.', 'Floor division removes a remainder. Read which kind of answer the patron needs.'] },
  { id: 'hazard-types', title: 'Ink is not a number', target: 'output', trigger: 'str_plus_int', steps: ['Text and numbers are different types even when both display digits.', 'Convert deliberately before joining text or doing arithmetic.'] },
  { id: 'hazard-range', title: 'The fence is excluded', target: 'request', trigger: 'lands_on_last', steps: ['A range stops before its stop value.', 'A boundary shelf in the queue will reveal a missing final plate.'] },
  { id: 'hazard-index', title: 'Count from zero', target: 'output', trigger: 'short_tray', steps: ['Three tiles have indices zero, one, and two.', 'Use the actual tray length when the requested position depends on its size.'] },
  { id: 'hazard-length', title: 'Pair the trays', target: 'output', trigger: 'length_mismatch', steps: ['Element-wise work needs compatible shapes.', 'Derive the companion tray from the current inputs rather than the first shelf you saw.'] },
  { id: 'hazard-mixed', title: 'Digits in disguise', target: 'output', trigger: 'mixed_strings', steps: ['One string can make a mixed array hold text.', 'Convert individual readings before constructing the numeric tray.'] },
  { id: 'hazard-empty', title: 'A perfectly empty answer', target: 'output', trigger: 'empty_result', steps: ['A sieve may keep no books. That can be correct.', 'An empty table still keeps its column labels.'] },
  { id: 'hazard-ties', title: 'Exactly on the line', target: 'request', trigger: 'ties_at_cutoff', steps: ['Several books may sit exactly on the cutoff.', 'The patron’s wording decides whether the boundary belongs in the result.'] },
  { id: 'atlas', title: 'A map of the house', target: 'atlas', trigger: 'chapter', steps: ['The Atlas lists every wing and the requests inside it.', 'Completed requests can be revisited at any time; Gold Stars open the next wing.'] },
  { id: 'charts', title: 'Drawings, not answers', target: 'output', trigger: 'chart', steps: ['A chart is recorded as a drawing in the output panel and in the replay.', 'Delivering a chart is not delivering a value; the patron still wants the number or table.'] },
  { id: 'archive', title: 'Lamp oil and lamplight', target: 'resources', trigger: 'archive', steps: ['The Sealed Archive opens with a supply of Lamp Oil, and later standing orders earn more.', 'Sampling trips burn oil in proportion to the queue. Required requests are always affordable: the archive lends what you lack.'] },
  { id: 'hats', title: 'A peg of small hats', target: 'shop', trigger: 'shop', steps: ['Each hat changes something real: ink, stars, oil, hints, or order speed.', 'Wear one at a time, and hang it back up whenever you like.'] },
  { id: 'offline', title: 'While the lamp was out', target: 'resources', trigger: 'offline', steps: ['Standing orders keep working while you are away, up to eight hours.', 'The trips are simulated on your return, so the ledger settles as soon as the library opens.'] },
  { id: 'capstone', title: 'The Grand Reopening', target: 'request', trigger: 'capstone', steps: ['The closing requests use everything: tables, sampling, tests, prediction.', 'When the last one passes, the doors open and the whole library is yours to browse.'] },
  { id: 'openstacks', title: 'Reading ahead', target: 'settings', trigger: 'settings', steps: ['Open Stacks lifts the API restriction and unlocks the Atlas for browsing.', 'The requests and their checks are unchanged; only the guard rails move.'] },
  { id: 'hazard-bookworms', title: 'Holes in the card', target: 'output', trigger: 'missing_values', steps: ['Bookworms leave gaps where a value should be.', 'Decide deliberately whether to drop those rows or fill them, and say so in your result.'] },
  { id: 'hazard-magpies', title: 'Magpie spelling', target: 'output', trigger: 'messy_strings', steps: ['Magpies scramble capitals and leave trailing spaces.', 'Tidy the text before grouping, or one category becomes three.'] },
  { id: 'hazard-text-numbers', title: 'Ten before nine', target: 'output', trigger: 'numbers_as_text', steps: ['Call numbers stored as text sort alphabetically, so 10 arrives before 9.', 'Convert the column before sorting or comparing.'] },
  { id: 'hazard-duplicates', title: 'Twin cards', target: 'output', trigger: 'duplicate_keys', steps: ['A join multiplies rows when a key appears twice on either side.', 'Count the rows before and after; an unexpected growth means duplicated keys.'] },
  { id: 'hazard-unmatched', title: 'The lost and found', target: 'output', trigger: 'unmatched_rows', steps: ['Rows without a partner quietly vanish from a join.', 'Check how many rows went missing before trusting the total.'] },
  { id: 'hazard-holiday', title: 'A holiday cart', target: 'output', trigger: 'empty_table', steps: ['Some shelves arrive empty, and that can be the right answer.', 'Guard any statistic that divides by the number of rows.'] },
  { id: 'hazard-bins', title: 'Wide bins, short bars', target: 'output', trigger: 'unequal_bins', steps: ['With unequal bins, height is density and area is the proportion.', 'Compare areas, not heights, and state the units.'] },
  { id: 'hazard-append', title: 'The result that was not kept', target: 'output', trigger: 'append_not_assigned', steps: ['np.append returns a new array instead of growing the old one.', 'Assign the result back, or the collection stays empty.'] },
  { id: 'hazard-replacement', title: 'With or without', target: 'request', trigger: 'sampling_replacement', steps: ['sample() draws with replacement by default, so repeats are expected.', 'A permutation needs with_replacement=False, and cannot exceed the table.'] },
  { id: 'hazard-repetitions', title: 'Too few trips', target: 'output', trigger: 'few_repetitions', steps: ['A handful of simulated trips gives a jagged, unreliable picture.', 'Run enough repetitions that the histogram settles between runs.'] },
  { id: 'hazard-tail', title: 'Which tail?', target: 'request', trigger: 'wrong_tail', steps: ['The p-value counts simulated statistics at least as extreme as the observed one.', 'Extreme means large for some statistics and small for others; follow the request.'] },
  { id: 'hazard-confounding', title: 'A third explanation', target: 'request', trigger: 'confounding', steps: ['Observed groups differ in more than the one thing you are studying.', 'Only a randomised display experiment supports a causal claim.'] },
  { id: 'hazard-percentile', title: 'Two kinds of percentile', target: 'output', trigger: 'percentile_definition', steps: ['This library’s percentile always returns an element of the data.', 'An interpolating percentile can return a value nobody observed.'] },
  { id: 'hazard-resample', title: 'The same sample again', target: 'output', trigger: 'resample_size', steps: ['A bootstrap resample is the same size as the original sample, drawn with replacement.', 'Change either and the interval is the wrong width.'] },
  { id: 'hazard-sd', title: 'Four times the cards', target: 'request', trigger: 'sample_size', steps: ['The spread of a sample mean shrinks with the square root of the sample size.', 'Halving the interval width costs four times the sample, and four times the lamp oil.'] },
  { id: 'hazard-outliers', title: 'One stubborn point', target: 'output', trigger: 'outliers', steps: ['A single distant point can swing a correlation and tilt a line.', 'Look at the scatter before trusting the number.'] },
  { id: 'hazard-extrapolation', title: 'Beyond the shelf', target: 'request', trigger: 'extrapolation', steps: ['A line fitted to one range says little outside it.', 'Predicting far beyond the data is a guess wearing a lab coat.'] },
  { id: 'hazard-scaling', title: 'Unequal yardsticks', target: 'output', trigger: 'unscaled_features', steps: ['Distance is dominated by whichever attribute has the largest units.', 'Convert attributes to standard units before measuring neighbours.'] },
  { id: 'hazard-training', title: 'Marking your own work', target: 'request', trigger: 'test_on_training', steps: ['A classifier scored on its training rows flatters itself.', 'Hold rows back and measure accuracy on those.'] },
  { id: 'hazard-baserate', title: 'The rare card', target: 'request', trigger: 'base_rate', steps: ['A test that is usually right can still be usually wrong about a rare event.', 'Work with counts in a tree before trusting an intuition.'] },
];

export function tutorialsFor(trigger: string, seen: readonly string[]): Tutorial[] {
  return tutorials.filter((entry) => entry.trigger === trigger && !seen.includes(entry.id));
}

export function getTutorial(id: string): Tutorial | undefined {
  return tutorials.find((entry) => entry.id === id);
}
