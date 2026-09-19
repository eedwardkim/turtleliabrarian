export interface AlmanacEntry {
  id: string;
  signature: string;
  explanation: string;
  example: string;
  output: string;
  pitfalls: string[];
  pitfallsAfter?: string;
}

export const almanac: AlmanacEntry[] = [
  { id: 'expressions', signature: 'name = expression', explanation: 'Give a result a name so the next line can use it. Python computes the right side first.', example: 'drops = 4 * 3\ndrops + 2', output: '14', pitfalls: ['= assigns a name; == compares two values.'] },
  { id: 'deliver', signature: 'deliver(value)', explanation: 'Hand a value to the waiting patron for checking.', example: 'deliver(2 + 5)', output: '7', pitfalls: ['Printing a value does not deliver it.'] },
  { id: 'print', signature: 'print(*values)', explanation: 'Write a note in the output panel while investigating your script.', example: "print('Tiles:', 4)", output: 'Tiles: 4', pitfalls: ['Printed output is separate from the delivered answer.'] },
  { id: 'division', signature: 'number / divisor; number // divisor', explanation: '/ keeps fractional shares; // rounds the quotient down.', example: '7 / 2\n7 // 2', output: '3.5\n3', pitfalls: ['Floor division loses the fractional part, even if an earlier shelf divided evenly.'], pitfallsAfter: 'p0-02-shares' },
  { id: 'round', signature: 'round(number, ndigits=0)', explanation: 'Round a number to a chosen number of decimal places.', example: 'round(8.376, 2)', output: '8.38', pitfalls: ['Rounding early can lose information; only round when requested.'] },
  { id: 'abs', signature: 'abs(number)', explanation: 'Return the distance from zero.', example: 'abs(-7)', output: '7', pitfalls: ['The sign disappears.'] },
  { id: 'max', signature: 'max(values) or max(a, b, ...)', explanation: 'Find the greatest value.', example: 'max(4, 9, 2)', output: '9', pitfalls: ['Text uses alphabetical comparison, not numeric magnitude.'] },
  { id: 'min', signature: 'min(values) or min(a, b, ...)', explanation: 'Find the smallest value.', example: 'min(4, 9, 2)', output: '2', pitfalls: ['An empty collection has no minimum.'] },
  { id: 'len', signature: 'len(collection)', explanation: 'Count the items in a collection, or characters in text.', example: "len('Moss')", output: '4', pitfalls: ['The count is one past the final index.'], pitfallsAfter: 'ch1-vary-1' },
  { id: 'str', signature: 'str(value)', explanation: 'Represent a value as text.', example: "'Tray-' + str(8)", output: "'Tray-8'", pitfalls: ['Adding text and an integer raises TypeError.'], pitfallsAfter: 'p0-03-badge' },
  { id: 'int', signature: 'int(value)', explanation: 'Read whole-number text as an integer, or truncate a numeric value toward zero.', example: "int('14') + 2", output: '16', pitfalls: ["int('3.5') fails; decimal text needs float first.", 'Comparing numeric text compares characters.'], pitfallsAfter: 'p0-04-budget' },
  { id: 'float', signature: 'float(value)', explanation: 'Read a decimal quantity from text.', example: "float('2.75') + 1", output: '3.75', pitfalls: ['Binary floating-point arithmetic can leave tiny rounding differences.'] },
  { id: 'comparisons', signature: 'a < b; a <= b; a == b; a >= b; a > b', explanation: 'Ask a yes-or-no question and get True or False.', example: '5 <= 5', output: 'True', pitfalls: ['Equality is included by <= and >=, but not < and >.'] },
  { id: 'make_array', signature: 'make_array(*elements)', explanation: 'Collect values into a NumPy array, a tray whose elements share a type.', example: 'make_array(3, 6, 9)', output: 'array([3, 6, 9])', pitfalls: ['Mixing text and numbers can convert every element to text.'], pitfallsAfter: 'ch1-break-2' },
  { id: 'array-math', signature: 'array * number; array + array', explanation: 'Apply arithmetic to every tile at once and return a new array.', example: 'make_array(2, 5) * 3', output: 'array([6, 15])', pitfalls: ['Two arrays must have compatible lengths.'], pitfallsAfter: 'ch1-break-1' },
  { id: 'np.arange', signature: 'np.arange(start, stop, step=1)', explanation: 'Build evenly spaced numbers, including start and excluding stop.', example: 'np.arange(3, 10, 2)', output: 'array([3, 5, 7, 9])', pitfalls: ['The stop itself is never included for integer steps.'], pitfallsAfter: 'ch1-show-2' },
  { id: 'item', signature: 'array.item(index)', explanation: 'Take one scalar from a zero-based position in an array.', example: 'make_array(8, 13).item(1)', output: '13', pitfalls: ['The final nonnegative index is len(array) - 1.'], pitfallsAfter: 'ch1-vary-1' },
  { id: 'sum', signature: 'sum(values)', explanation: 'Add all the values together.', example: 'sum(make_array(2, 4, 7))', output: '13', pitfalls: ['A total and a mean answer different questions.'] },
  { id: 'np.mean', signature: 'np.mean(array)', explanation: 'Divide a total by the number of elements.', example: 'np.mean(make_array(2, 4, 9))', output: '5.0', pitfalls: ['An average need not be one of the observed values.'] },
  { id: 'np.count_nonzero', signature: 'np.count_nonzero(array)', explanation: 'Count nonzero values; on a boolean tray this counts True.', example: 'np.count_nonzero(make_array(1, 5, 7) >= 5)', output: '2', pitfalls: ['Use the comparison requested, including or excluding equality deliberately.'] },
  { id: 'matching-lengths', signature: 'len(left) == len(right)', explanation: 'Check that two trays pair one tile to one tile.', example: 'len(make_array(1, 2)) == len(make_array(3, 4))', output: 'True', pitfalls: ['A fixed-length companion fails when a new shelf has another size.'], pitfallsAfter: 'ch1-break-1' },
  { id: 'mixed-types', signature: 'make_array(int(a), int(b))', explanation: 'Convert numeric text before choosing a shared numeric array type.', example: "make_array(int('8'), int('3')) + 1", output: 'array([9, 4])', pitfalls: ['Digit-shaped strings still do not support numeric array arithmetic.'], pitfallsAfter: 'ch1-break-2' },
  { id: 'Table', signature: 'Table()', explanation: 'Create an empty table, ready for named columns.', example: 'Table().with_columns("title", make_array("Cloud"), "pages", make_array(80))', output: 'title | pages\nCloud | 80', pitfalls: ['Each column must have the same number of rows.'] },
  { id: 'with_columns', signature: 'table.with_columns(label, values, ...)', explanation: 'Return a table with added or replaced columns.', example: "Table().with_columns('pages', make_array(40, 90))", output: 'pages\n40\n90', pitfalls: ['Keep the returned table; the original is unchanged.'] },
  { id: 'column', signature: 'table.column(label)', explanation: 'Take a single column as an array.', example: "Table().with_columns('n', make_array(2, 8)).column('n')", output: 'array([2, 8])', pitfalls: ['An array no longer carries table column labels.'] },
  { id: 'select', signature: 'table.select(*labels)', explanation: 'Return a new table containing the requested columns in the requested order.', example: "Table().with_columns('a', make_array(1), 'b', make_array(2)).select('b')", output: 'b\n2', pitfalls: ['Calling select alone leaves the original table intact.'], pitfallsAfter: 'ch2-show-1' },
  { id: 'drop', signature: 'table.drop(*labels)', explanation: 'Return a table without selected columns.', example: "Table().with_columns('a', make_array(1), 'b', make_array(2)).drop('a')", output: 'b\n2', pitfalls: ['Column labels are exact, including case.'] },
  { id: 'relabeled', signature: 'table.relabeled(old, new)', explanation: 'Return a table with a different column label.', example: "Table().with_columns('n', make_array(3)).relabeled('n', 'count')", output: 'count\n3', pitfalls: ['Values stay unchanged; later operations must use the new label.'] },
  { id: 'labels', signature: 'table.labels', explanation: 'Inspect the column names in order.', example: "Table().with_columns('n', make_array(3)).labels", output: "('n',)", pitfalls: ['This is a property, so it has no call parentheses.'] },
  { id: 'num_rows', signature: 'table.num_rows', explanation: 'Count the books in a table.', example: "Table().with_columns('n', make_array(3, 4)).num_rows", output: '2', pitfalls: ['A filtered result can have zero rows.'] },
  { id: 'num_columns', signature: 'table.num_columns', explanation: 'Count the fields on each catalog card.', example: "Table().with_columns('n', make_array(3)).num_columns", output: '1', pitfalls: ['This counts columns, not books.'] },
  { id: 'where', signature: 'table.where(label, predicate)', explanation: 'Copy matching rows to a new table, leaving the source untouched.', example: "Table().with_columns('n', make_array(1, 4)).where('n', are.above(2))", output: 'n\n4', pitfalls: ['An empty result is valid and retains its labels.'], pitfallsAfter: 'ch2-show-2' },
  { id: 'sort', signature: 'table.sort(label, descending=False, distinct=False)', explanation: 'Return rows ordered by a column; ascending is the default.', example: "Table().with_columns('n', make_array(4, 1)).sort('n')", output: 'n\n1\n4', pitfalls: ['Sorting text digits is different from sorting numeric values.'] },
  { id: 'take', signature: 'table.take(indices)', explanation: 'Return rows at the given zero-based positions.', example: "Table().with_columns('n', make_array(4, 9)).take(1)", output: 'n\n9', pitfalls: ['A position beyond the final row raises IndexError.'] },
  { id: 'are.above_or_equal_to', signature: 'are.above_or_equal_to(value)', explanation: 'Build a predicate that keeps the boundary and everything above it.', example: "Table().with_columns('n', make_array(2, 3)).where('n', are.above_or_equal_to(3))", output: 'n\n3', pitfalls: ['A strict comparison would lose ties at the cutoff.'], pitfallsAfter: 'ch2-show-2' },
  { id: 'are.above', signature: 'are.above(value)', explanation: 'Build a predicate for strictly greater values.', example: "Table().with_columns('n', make_array(2, 3)).where('n', are.above(2))", output: 'n\n3', pitfalls: ['The boundary itself does not pass.'] },
  { id: 'are.equal_to', signature: 'are.equal_to(value)', explanation: 'Build a predicate for exact equality.', example: "Table().with_columns('n', make_array(2, 3)).where('n', are.equal_to(2))", output: 'n\n2', pitfalls: ['Text equality is case-sensitive.'] },
];

export function visibleAlmanac(unlocked: readonly string[], completed: readonly string[]): AlmanacEntry[] {
  return almanac.filter((entry) => unlocked.includes(entry.id)).map((entry) => ({
    ...entry,
    pitfalls: !entry.pitfallsAfter || completed.includes(entry.pitfallsAfter) ? entry.pitfalls : [],
  }));
}
