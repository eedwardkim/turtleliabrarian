export const engineCases = [
  {
    name: 'stdout and notebook last expression',
    request: { code: 'print("shelved")\n21 * 2' },
    expected: { value: 42, stdout: 'shelved\n', error: null },
  },
  {
    name: 'delivery is distinct from the final expression',
    request: { code: 'deliver(7)\n42' },
    expected: { value: 42, delivered: 7, error: null },
  },
  {
    name: 'Python namespace creation',
    request: { code: 'private_name = 7\nprivate_name' },
    expected: { value: 7, error: null },
  },
  {
    name: 'fresh player namespace',
    request: { code: 'private_name' },
    expectedError: { type: 'NameError', line: 1 },
  },
  {
    name: 'Python syntax error with player line',
    request: { code: 'if True print("book")' },
    expectedError: { type: 'SyntaxError', line: 1 },
  },
  {
    name: 'None request and result conversion',
    request: { code: 'deliver(book)\nbook', inputs: { book: null } },
    expected: { value: null, delivered: null, error: null, inputs: { book: null } },
  },
  {
    name: 'actual NumPy execution',
    request: { code: 'import numpy as np\nfloat(np.mean(np.arange(1, 5)))' },
    expected: { value: 2.5, error: null },
  },
  {
    name: 'player module imports',
    request: { code: 'from helper import answer\nanswer', files: { 'helper.py': 'answer = 42\n' } },
    expected: { value: 42, error: null },
  },
  {
    name: 'updated player modules are fresh',
    request: { code: 'from helper import answer\nanswer', files: { 'helper.py': 'answer = 43\n' } },
    expected: { value: 43, error: null },
  },
  {
    name: 'table inputs, filtering and delivery',
    request: {
      code: 'from datascience import *\ndeliver(shelf.where("pages", are.above(10)))',
      inputs: { shelf: { kind: 'table', labels: ['title', 'pages'], rows: [['Cloud', 12], ['Moss', 8]], totalRows: 2 } },
    },
    expectedTable: { labels: ['title', 'pages'], rows: [['Cloud', 12]], totalRows: 1 },
  },
  {
    name: 'trusted generated input',
    request: { code: 'book_count', inputCode: 'book_count = 9' },
    expected: { value: 9, error: null },
  },
  {
    name: 'seeded NumPy run A',
    request: { code: 'import numpy as np\nint(np.random.choice(1000))', seed: 47 },
    expected: { error: null },
  },
  {
    name: 'seeded NumPy run B',
    request: { code: 'import numpy as np\nint(np.random.choice(1000))', seed: 47 },
    expected: { error: null },
    sameAs: 'seeded NumPy run A',
  },
  {
    name: 'cooperative timeout before hard worker deadline',
    request: { code: 'while True:\n    pass', budgetMs: 50 },
    expectedError: { type: 'TimeoutError' },
    timingDependent: true,
  },
];
