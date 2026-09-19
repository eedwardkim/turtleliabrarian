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
];

export function tutorialsFor(trigger: string, seen: readonly string[]): Tutorial[] {
  return tutorials.filter((entry) => entry.trigger === trigger && !seen.includes(entry.id));
}

export function getTutorial(id: string): Tutorial | undefined {
  return tutorials.find((entry) => entry.id === id);
}
