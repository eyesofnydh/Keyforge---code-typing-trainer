/* ==========================================================================
   Keyforge — drill content
   Symbol tracks are language-agnostic. Keyword + snippet tracks are per-language.
   ========================================================================== */

export const LANGUAGES = {
  javascript: { label: 'JavaScript' },
  typescript: { label: 'TypeScript' },
  python: { label: 'Python' },
  go: { label: 'Go' },
  rust: { label: 'Rust' },
  sql: { label: 'SQL' },
};

/* --- Track 1: symbol clusters ------------------------------------------- */

export const SYMBOL_SETS = {
  brackets: {
    label: 'Bracket pairs',
    hint: 'Right pinky and ring finger. Reach, do not lean.',
    groups: ['()', '[]', '{}', '(())', '[{}]', '({})', '[]()', '{[]}', '()[]', '(){}', '[()]', '{()}'],
  },
  angles: {
    label: 'Angles & arrows',
    hint: 'Left/right pinky for < > with shift. Arrows are two-key rhythms.',
    groups: ['<>', '</>', '=>', '->', '<=', '>=', '</', '/>', '<<', '>>', '<=>', '|>'],
  },
  operators: {
    label: 'Operators',
    hint: 'Compound operators are single muscle-memory units, not two keys.',
    groups: ['===', '!==', '+=', '-=', '*=', '/=', '%=', '**', '++', '--', '?.', '??', '::', '&&', '||', '!=', '>>=', '|='],
  },
  quotes: {
    label: 'Quotes & punctuation',
    hint: 'The home-row pinky reach for : ; \' " is the most common code stutter.',
    groups: ['""', "''", '``', "';", '":', "',", '.;', ':=', '";', "':", '...', '";,'],
  },
  shifted: {
    label: 'Shifted row',
    hint: 'Alternate shift hands: left shift for right-hand symbols and back.',
    groups: ['~/', '@id', '#tag', '$var', '^2', '&ref', '_id', '%s', '!x', '|>', '\\n', '$#@'],
  },
  mixed: {
    label: 'Mixed symbols',
    hint: 'Everything at once. Accuracy over speed.',
    groups: [
      '=>', '{}', '[]', '()', '!==', '?.', '::', '&&', '||', '->', '</>', '$_',
      '"";', "':", '#!', '|>', '**', '++', '~/', '@#', '%d', '\\t', '<=>', '??',
    ],
  },
};

/* --- Track 2: keyword vocabularies -------------------------------------- */

export const KEYWORDS = {
  javascript: ['const', 'let', 'async', 'await', 'return', 'function', 'class', 'extends', 'import', 'export', 'default', 'from', 'typeof', 'instanceof', 'null', 'undefined', 'this', 'new', 'try', 'catch', 'finally', 'throw', 'for', 'while', 'switch', 'case', 'break', 'continue', 'yield', 'static', 'get', 'set', 'delete', 'void'],
  typescript: ['interface', 'type', 'enum', 'implements', 'readonly', 'keyof', 'satisfies', 'as', 'unknown', 'never', 'extends', 'infer', 'declare', 'namespace', 'abstract', 'private', 'protected', 'public', 'Partial', 'Record', 'Promise', 'Awaited', 'const', 'export', 'generic', 'asserts'],
  python: ['def', 'class', 'return', 'import', 'from', 'as', 'lambda', 'yield', 'async', 'await', 'with', 'try', 'except', 'finally', 'raise', 'for', 'while', 'if', 'elif', 'else', 'not', 'and', 'or', 'in', 'is', 'None', 'True', 'False', 'self', 'global', 'nonlocal', 'assert', 'pass', 'del'],
  go: ['func', 'package', 'import', 'var', 'const', 'type', 'struct', 'interface', 'map', 'chan', 'go', 'defer', 'select', 'range', 'return', 'if', 'else', 'for', 'switch', 'case', 'fallthrough', 'nil', 'err', 'make', 'append', 'string', 'error', 'bool', 'int64'],
  rust: ['fn', 'let', 'mut', 'struct', 'enum', 'impl', 'trait', 'pub', 'use', 'mod', 'match', 'Some', 'None', 'Ok', 'Err', 'Result', 'Option', 'Vec', 'String', 'self', 'crate', 'where', 'dyn', 'async', 'move', 'unsafe', 'derive', 'ref'],
  sql: ['SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'INNER', 'OUTER', 'GROUP', 'BY', 'ORDER', 'HAVING', 'LIMIT', 'OFFSET', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'TABLE', 'ALTER', 'INDEX', 'DISTINCT', 'COUNT', 'COALESCE', 'CASE', 'WHEN', 'THEN', 'END', 'AS', 'ON', 'AND', 'OR', 'NULL'],
};

/* --- Track 3: real snippets --------------------------------------------- */

export const SNIPPETS = {
  javascript: [
    {
      title: 'Async fetch with retry',
      code: `async function fetchJSON(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
      return await res.json();
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, 2 ** i * 100));
    }
  }
}`,
    },
    {
      title: 'Array pipeline',
      code: `const summary = orders
  .filter((o) => o.status !== 'cancelled')
  .map(({ id, total, items }) => ({ id, total, count: items.length }))
  .reduce((acc, o) => {
    acc.revenue += o.total;
    acc.units += o.count;
    return acc;
  }, { revenue: 0, units: 0 });`,
    },
    {
      title: 'Debounced listener',
      code: `function debounce(fn, wait = 200) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

window.addEventListener('resize', debounce(() => {
  document.body.dataset.width = \`\${window.innerWidth}\`;
}, 150));`,
    },
  ],
  typescript: [
    {
      title: 'Generic result type',
      code: `type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export async function attempt<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, value: await fn() };
  } catch (error) {
    return { ok: false, error: error as Error };
  }
}`,
    },
    {
      title: 'Interface + mapped type',
      code: `interface User {
  id: string;
  email: string;
  roles: Array<'admin' | 'editor' | 'viewer'>;
  meta?: Record<string, unknown>;
}

type Patch<T> = { [K in keyof T]?: T[K] | null };

const update = (id: string, patch: Patch<User>): void => {
  store.set(id, { ...store.get(id)!, ...patch });
};`,
    },
    {
      title: 'Discriminated reducer',
      code: `type Action =
  | { type: 'add'; payload: Item }
  | { type: 'remove'; id: string };

function reducer(state: Item[], action: Action): Item[] {
  switch (action.type) {
    case 'add':
      return [...state, action.payload];
    case 'remove':
      return state.filter((i) => i.id !== action.id);
  }
}`,
    },
  ],
  python: [
    {
      title: 'Dataclass + comprehension',
      code: `from dataclasses import dataclass, field

@dataclass(slots=True)
class Order:
    id: str
    total: float
    items: list[str] = field(default_factory=list)

    @property
    def unit_price(self) -> float:
        return self.total / max(len(self.items), 1)

totals = {o.id: round(o.unit_price, 2) for o in orders if o.total > 0}`,
    },
    {
      title: 'Async gather',
      code: `import asyncio, httpx

async def fetch_all(urls: list[str]) -> dict[str, int]:
    async with httpx.AsyncClient(timeout=10.0) as client:
        results = await asyncio.gather(
            *(client.get(u) for u in urls), return_exceptions=True
        )
    return {
        u: (r.status_code if not isinstance(r, Exception) else -1)
        for u, r in zip(urls, results)
    }`,
    },
    {
      title: 'Context manager',
      code: `from contextlib import contextmanager
import time

@contextmanager
def timed(label: str):
    start = time.perf_counter()
    try:
        yield
    finally:
        elapsed = (time.perf_counter() - start) * 1_000
        print(f"{label}: {elapsed:.2f}ms")

with timed("query"):
    rows = cursor.execute("SELECT * FROM users WHERE active = 1").fetchall()`,
    },
  ],
  go: [
    {
      title: 'HTTP handler',
      code: `func handleUser(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	user, err := store.Get(r.Context(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(user); err != nil {
		log.Printf("encode: %v", err)
	}
}`,
    },
    {
      title: 'Worker pool',
      code: `func run(jobs []Job, workers int) []Result {
	in := make(chan Job)
	out := make(chan Result, len(jobs))
	var wg sync.WaitGroup

	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := range in {
				out <- process(j)
			}
		}()
	}
	for _, j := range jobs {
		in <- j
	}
	close(in)
	wg.Wait()
	close(out)
	return drain(out)
}`,
    },
    {
      title: 'Struct + method',
      code: `type Cache[K comparable, V any] struct {
	mu   sync.RWMutex
	data map[K]V
}

func (c *Cache[K, V]) Get(key K) (V, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	v, ok := c.data[key]
	return v, ok
}`,
    },
  ],
  rust: [
    {
      title: 'Result & match',
      code: `fn parse_config(raw: &str) -> Result<Config, ConfigError> {
    let parsed: Value = serde_json::from_str(raw)?;
    match parsed.get("port").and_then(|p| p.as_u64()) {
        Some(p) if p <= 65_535 => Ok(Config { port: p as u16 }),
        Some(p) => Err(ConfigError::OutOfRange(p)),
        None => Err(ConfigError::Missing("port")),
    }
}`,
    },
    {
      title: 'Trait impl',
      code: `pub trait Store {
    fn get(&self, key: &str) -> Option<Vec<u8>>;
    fn put(&mut self, key: String, value: Vec<u8>) -> usize;
}

impl Store for MemStore {
    fn get(&self, key: &str) -> Option<Vec<u8>> {
        self.inner.get(key).cloned()
    }

    fn put(&mut self, key: String, value: Vec<u8>) -> usize {
        let len = value.len();
        self.inner.insert(key, value);
        len
    }
}`,
    },
    {
      title: 'Iterator chain',
      code: `let total: u64 = orders
    .iter()
    .filter(|o| o.status != Status::Cancelled)
    .flat_map(|o| o.items.iter())
    .map(|i| i.price_cents * i.qty as u64)
    .sum();

println!("{total} cents across {} orders", orders.len());`,
    },
  ],
  sql: [
    {
      title: 'Join + aggregate',
      code: `SELECT
    u.id,
    u.email,
    COUNT(o.id) AS order_count,
    COALESCE(SUM(o.total), 0) AS lifetime_value
FROM users AS u
LEFT JOIN orders AS o ON o.user_id = u.id AND o.status <> 'cancelled'
WHERE u.created_at >= '2026-01-01'
GROUP BY u.id, u.email
HAVING COUNT(o.id) > 2
ORDER BY lifetime_value DESC
LIMIT 50;`,
    },
    {
      title: 'CTE + window',
      code: `WITH ranked AS (
    SELECT
        product_id,
        region,
        SUM(qty) AS units,
        ROW_NUMBER() OVER (PARTITION BY region ORDER BY SUM(qty) DESC) AS rn
    FROM sales
    WHERE sold_at >= NOW() - INTERVAL '30 days'
    GROUP BY product_id, region
)
SELECT * FROM ranked WHERE rn <= 3;`,
    },
    {
      title: 'DDL + upsert',
      code: `CREATE TABLE IF NOT EXISTS sessions (
    id          UUID PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at  TIMESTAMPTZ NOT NULL,
    payload     JSONB DEFAULT '{}'::jsonb
);

INSERT INTO sessions (id, user_id, expires_at)
VALUES ($1, $2, NOW() + INTERVAL '14 days')
ON CONFLICT (id) DO UPDATE SET expires_at = EXCLUDED.expires_at;`,
    },
  ],
};

/* --- Keyboard layout for the heat map ----------------------------------- */
/* [base, shifted] — stats are aggregated per physical key. */

export const KEY_ROWS = [
  [['`', '~'], ['1', '!'], ['2', '@'], ['3', '#'], ['4', '$'], ['5', '%'], ['6', '^'], ['7', '&'], ['8', '*'], ['9', '('], ['0', ')'], ['-', '_'], ['=', '+']],
  [['q', 'Q'], ['w', 'W'], ['e', 'E'], ['r', 'R'], ['t', 'T'], ['y', 'Y'], ['u', 'U'], ['i', 'I'], ['o', 'O'], ['p', 'P'], ['[', '{'], [']', '}'], ['\\', '|']],
  [['a', 'A'], ['s', 'S'], ['d', 'D'], ['f', 'F'], ['g', 'G'], ['h', 'H'], ['j', 'J'], ['k', 'K'], ['l', 'L'], [';', ':'], ["'", '"']],
  [['z', 'Z'], ['x', 'X'], ['c', 'C'], ['v', 'V'], ['b', 'B'], ['n', 'N'], ['m', 'M'], [',', '<'], ['.', '>'], ['/', '?']],
];

export const KEY_FOR_CHAR = (() => {
  const m = new Map();
  for (const row of KEY_ROWS) {
    for (const [base, shifted] of row) {
      m.set(base, base);
      m.set(shifted, base);
    }
  }
  m.set(' ', ' ');
  return m;
})();
