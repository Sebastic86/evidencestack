import { describe, expect, it } from 'vitest';
import {
  analyzeStack,
  decodeStack,
  encodeStack,
  newEntryId,
  parseStackPaste,
  type CompoundMatcher,
  type DoseGuide,
  type PasteResult,
  type StackEntry,
} from './stack';

/**
 * Stack checker arithmetic and the share-URL wire format.
 *
 * Two properties are locked down deliberately, because they are what a future
 * refactor would silently break:
 *   - entry ids are session-local and must never reach the encoded URL;
 *   - a URL encoded before ids existed must still decode.
 */

const entry = (over: Partial<StackEntry> = {}): StackEntry => ({
  id: newEntryId(),
  compoundId: null,
  name: 'Something',
  dailyMg: 100,
  ...over,
});

const guide = (over: Partial<DoseGuide> = {}): DoseGuide => ({
  compoundId: 'magnesium',
  name: 'Magnesium',
  bestGrade: 'B',
  bestClaim: 'sleep onset latency',
  ...over,
});

/** studiedMin 200 => the under-studied threshold is 100; UL 350. */
const MAGNESIUM = guide({ studiedMinMg: 200, studiedMaxMg: 400, ulMg: 350 });
const GUIDES: Record<string, DoseGuide> = { magnesium: MAGNESIUM };

const verdictAt = (dailyMg: number, g: DoseGuide = MAGNESIUM) =>
  analyzeStack([entry({ compoundId: g.compoundId, dailyMg })], { [g.compoundId]: g })[0]!.verdict;

// ---------------------------------------------------------------------------
// Verdict boundaries — on the boundary, and one step either side of it.
// ---------------------------------------------------------------------------

describe('analyzeStack — upper-limit boundary', () => {
  it('is IN RANGE exactly on the UL: the tolerable upper intake level is tolerable', () => {
    expect(verdictAt(350)).toBe('in-range');
  });

  it('is OVER the UL one step above it', () => {
    expect(verdictAt(350.01)).toBe('over-ul');
    expect(verdictAt(351)).toBe('over-ul');
  });

  it('is IN RANGE one step below the UL', () => {
    expect(verdictAt(349.99)).toBe('in-range');
  });

  it('crosses the UL on the merged total, not on any single entry', () => {
    const lines = analyzeStack(
      [
        entry({ compoundId: 'magnesium', name: 'Mag glycinate', dailyMg: 200 }),
        entry({ compoundId: 'magnesium', name: 'Multivit', dailyMg: 200 }),
      ],
      GUIDES,
    );
    expect(lines[0]!.totalMg).toBe(400);
    expect(lines[0]!.verdict).toBe('over-ul');
  });

  it('reports over-ul even when the total is also below the studied minimum', () => {
    // A guide whose UL sits under half its studied minimum is contradictory data,
    // but the safety verdict must win rather than the "you take too little" one.
    const weird = guide({ compoundId: 'x', studiedMinMg: 1000, ulMg: 10 });
    expect(verdictAt(50, weird)).toBe('over-ul');
  });
});

describe('analyzeStack — under-studied boundary (half the studied minimum)', () => {
  it('is IN RANGE exactly on half the studied minimum', () => {
    expect(verdictAt(100)).toBe('in-range');
  });

  it('is UNDER-STUDIED one step below half the studied minimum', () => {
    expect(verdictAt(99.99)).toBe('under-studied');
    expect(verdictAt(1)).toBe('under-studied');
  });

  it('is IN RANGE one step above half the studied minimum', () => {
    expect(verdictAt(100.01)).toBe('in-range');
  });

  it('does not flag a dose that is merely below the studied minimum but above half of it', () => {
    expect(verdictAt(150)).toBe('in-range');
    expect(verdictAt(199)).toBe('in-range');
  });
});

describe('analyzeStack — verdict when the guide is partial', () => {
  it('with a UL only, compares against the UL and calls everything else in-range', () => {
    const g = guide({ compoundId: 'ul-only', ulMg: 350 });
    expect(verdictAt(1, g)).toBe('in-range');
    expect(verdictAt(350, g)).toBe('in-range');
    expect(verdictAt(351, g)).toBe('over-ul');
  });

  it('with a studied minimum only, never says over-ul', () => {
    const g = guide({ compoundId: 'min-only', studiedMinMg: 200 });
    expect(verdictAt(99, g)).toBe('under-studied');
    expect(verdictAt(100, g)).toBe('in-range');
    expect(verdictAt(1_000_000, g)).toBe('in-range');
  });

  it('with only a studied MAXIMUM, has no data to judge on — studiedMaxMg is display-only', () => {
    // Documents current behaviour: the verdict logic reads studiedMinMg and ulMg only.
    const g = guide({ compoundId: 'max-only', studiedMaxMg: 400 });
    expect(verdictAt(10_000, g)).toBe('no-data');
  });

  it('says no-data for a guide with no dose numbers at all', () => {
    expect(verdictAt(500, guide({ compoundId: 'bare' }))).toBe('no-data');
  });

  it('says no-data for a matched compound that has no guide in the register', () => {
    const lines = analyzeStack([entry({ compoundId: 'taurine', dailyMg: 3000 })], GUIDES);
    expect(lines[0]!.guide).toBeNull();
    expect(lines[0]!.verdict).toBe('no-data');
  });

  it('says no-data for an unmatched product name', () => {
    const lines = analyzeStack([entry({ compoundId: null, name: 'Multivit Forte', dailyMg: 500 })], GUIDES);
    expect(lines[0]!.compoundId).toBeNull();
    expect(lines[0]!.verdict).toBe('no-data');
  });
});

// ---------------------------------------------------------------------------
// Duplicate merging
// ---------------------------------------------------------------------------

describe('analyzeStack — duplicate merging', () => {
  it('merges two entries of the same compound and sums dose and cost', () => {
    const lines = analyzeStack(
      [
        entry({ compoundId: 'magnesium', name: 'Mag glycinate', dailyMg: 200, monthlyEur: 9.5 }),
        entry({ compoundId: 'magnesium', name: 'Sleep blend', dailyMg: 120, monthlyEur: 4.5 }),
      ],
      GUIDES,
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]!.totalMg).toBe(320);
    expect(lines[0]!.monthlyEur).toBe(14);
    expect(lines[0]!.duplicated).toBe(true);
    expect(lines[0]!.sources.map((s) => s.name)).toEqual(['Mag glycinate', 'Sleep blend']);
  });

  it('keeps every contributing entry id on the line, so one source can be removed alone', () => {
    const a = entry({ compoundId: 'magnesium', name: 'A', dailyMg: 100 });
    const b = entry({ compoundId: 'magnesium', name: 'B', dailyMg: 100 });
    const [line] = analyzeStack([a, b], GUIDES);
    expect(line!.sources).toEqual([
      { id: a.id, name: 'A' },
      { id: b.id, name: 'B' },
    ]);
  });

  it('does not mark a single entry as duplicated', () => {
    const [line] = analyzeStack([entry({ compoundId: 'magnesium', dailyMg: 200 })], GUIDES);
    expect(line!.duplicated).toBe(false);
    expect(line!.sources).toHaveLength(1);
  });

  it('merges unmatched names case-insensitively and ignoring surrounding whitespace', () => {
    const lines = analyzeStack(
      [
        entry({ compoundId: null, name: 'Vit C ', dailyMg: 500 }),
        entry({ compoundId: null, name: 'vit c', dailyMg: 500 }),
        entry({ compoundId: null, name: '  VIT C  ', dailyMg: 500 }),
      ],
      GUIDES,
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]!.totalMg).toBe(1500);
    expect(lines[0]!.duplicated).toBe(true);
    expect(lines[0]!.groupKey).toBe('unknown:vit c');
    // The line shows the first spelling entered; the group key is the normalised one.
    expect(lines[0]!.name).toBe('Vit C ');
  });

  it('does not merge genuinely different unmatched names', () => {
    const lines = analyzeStack(
      [
        entry({ compoundId: null, name: 'Vit C', dailyMg: 500 }),
        entry({ compoundId: null, name: 'Vitamin C', dailyMg: 500 }),
      ],
      GUIDES,
    );
    expect(lines).toHaveLength(2);
    expect(lines.every((l) => l.duplicated)).toBe(false);
  });

  it('does not merge a matched compound with a same-named unmatched entry', () => {
    // Register identity wins: an entry matched to `magnesium` is not the same line as
    // a free-typed "Magnesium", because only the matched one carries the dose guide.
    const lines = analyzeStack(
      [
        entry({ compoundId: 'magnesium', name: 'Magnesium', dailyMg: 200 }),
        entry({ compoundId: null, name: 'Magnesium', dailyMg: 200 }),
      ],
      GUIDES,
    );
    expect(lines).toHaveLength(2);
    expect(lines.map((l) => l.groupKey).sort()).toEqual(['magnesium', 'unknown:magnesium']);
  });

  it('prefers the register name over the name the user typed', () => {
    const [line] = analyzeStack(
      [entry({ compoundId: 'magnesium', name: 'Cheap Mag Tabs', dailyMg: 200 })],
      GUIDES,
    );
    expect(line!.name).toBe('Magnesium');
    expect(line!.sources[0]!.name).toBe('Cheap Mag Tabs'); // the source keeps what was typed
  });

  it('treats a missing monthlyEur as zero', () => {
    const [line] = analyzeStack(
      [
        entry({ compoundId: 'magnesium', dailyMg: 100, monthlyEur: 12 }),
        entry({ compoundId: 'magnesium', dailyMg: 100 }),
      ],
      GUIDES,
    );
    expect(line!.monthlyEur).toBe(12);
  });

  it('sorts doubled-up lines first, then by monthly cost descending', () => {
    const lines = analyzeStack(
      [
        entry({ compoundId: null, name: 'Expensive single', dailyMg: 10, monthlyEur: 90 }),
        entry({ compoundId: null, name: 'Cheap single', dailyMg: 10, monthlyEur: 1 }),
        entry({ compoundId: 'magnesium', name: 'Dupe a', dailyMg: 10, monthlyEur: 2 }),
        entry({ compoundId: 'magnesium', name: 'Dupe b', dailyMg: 10, monthlyEur: 3 }),
      ],
      GUIDES,
    );
    expect(lines.map((l) => l.name)).toEqual(['Magnesium', 'Expensive single', 'Cheap single']);
    expect(lines[0]!.duplicated).toBe(true);
  });

  it('returns an empty list for an empty stack', () => {
    expect(analyzeStack([], GUIDES)).toEqual([]);
  });

  it('does not mutate the entries it is given', () => {
    const entries = [entry({ compoundId: 'magnesium', dailyMg: 200 })];
    const snapshot = JSON.parse(JSON.stringify(entries));
    analyzeStack(entries, GUIDES);
    expect(JSON.parse(JSON.stringify(entries))).toEqual(snapshot);
  });
});

// ---------------------------------------------------------------------------
// Share URL round-tripping
// ---------------------------------------------------------------------------

/** Decode a base64url payload back to its JSON text, without going through decodeStack. */
function rawPayload(s: string): string {
  const b64 = s.replaceAll('-', '+').replaceAll('_', '/');
  return new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
}

/** base64url-encode a JSON string, to craft hostile payloads by hand. */
function craft(json: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(json)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}

describe('encodeStack / decodeStack — round trip', () => {
  it('preserves compound id, name, dose and cost', () => {
    const entries = [
      entry({ compoundId: 'magnesium', name: 'Mag glycinate', dailyMg: 200, monthlyEur: 9.5 }),
      entry({ compoundId: null, name: 'Multivit Forte', dailyMg: 500, monthlyEur: 12 }),
    ];
    const decoded = decodeStack(encodeStack(entries));
    expect(decoded.map(({ id, ...rest }) => rest)).toEqual([
      { compoundId: 'magnesium', name: 'Mag glycinate', dailyMg: 200, monthlyEur: 9.5 },
      { compoundId: null, name: 'Multivit Forte', dailyMg: 500, monthlyEur: 12 },
    ]);
  });

  it('produces a URL-safe payload: no +, /, = or characters needing escaping', () => {
    const s = encodeStack([entry({ compoundId: null, name: 'a/b+c?d&e=f', dailyMg: 1, monthlyEur: 0.5 })]);
    expect(s).toMatch(/^[A-Za-z0-9_-]*$/);
    expect(encodeURIComponent(s)).toBe(s);
  });

  it('round-trips non-ASCII names through UTF-8', () => {
    const name = 'Vitamine D₃ — Ω-3 café 日本';
    const decoded = decodeStack(encodeStack([entry({ compoundId: null, name, dailyMg: 25 })]));
    expect(decoded[0]!.name).toBe(name);
  });

  it('round-trips fractional doses', () => {
    const decoded = decodeStack(encodeStack([entry({ compoundId: 'vitamin-d', name: 'D3', dailyMg: 0.025 })]));
    expect(decoded[0]!.dailyMg).toBe(0.025);
  });

  it('normalises a zero or absent cost back to undefined', () => {
    const decoded = decodeStack(
      encodeStack([entry({ name: 'no cost', dailyMg: 100 }), entry({ name: 'zero cost', dailyMg: 100, monthlyEur: 0 })]),
    );
    expect(decoded[0]!.monthlyEur).toBeUndefined();
    expect(decoded[1]!.monthlyEur).toBeUndefined();
  });

  it('survives a full encode -> decode -> analyze cycle with the same verdicts and totals', () => {
    const entries = [
      entry({ compoundId: 'magnesium', name: 'Mag A', dailyMg: 200, monthlyEur: 5 }),
      entry({ compoundId: 'magnesium', name: 'Mag B', dailyMg: 200, monthlyEur: 5 }),
    ];
    const before = analyzeStack(entries, GUIDES);
    const after = analyzeStack(decodeStack(encodeStack(entries)), GUIDES);
    expect(after.map(({ sources, ...l }) => l)).toEqual(before.map(({ sources, ...l }) => l));
    expect(after[0]!.verdict).toBe('over-ul');
  });

  it('encodes an empty stack to something that decodes back to empty', () => {
    expect(decodeStack(encodeStack([]))).toEqual([]);
  });
});

describe('encodeStack — entry ids must never reach the URL', () => {
  it('emits exactly four fields per entry, in the documented order', () => {
    const e = entry({ compoundId: 'magnesium', name: 'Mag', dailyMg: 200, monthlyEur: 9.5 });
    const packed = JSON.parse(rawPayload(encodeStack([e])));
    expect(packed).toEqual([['magnesium', 'Mag', 200, 9.5]]);
    expect(packed[0]).toHaveLength(4);
  });

  it('never contains the id string anywhere in the payload', () => {
    const e = entry({ compoundId: 'magnesium', name: 'Mag', dailyMg: 200 });
    expect(rawPayload(encodeStack([e]))).not.toContain(e.id);
  });

  it('encodes two stacks that differ only in ids to byte-identical strings', () => {
    const shape = { compoundId: 'magnesium', name: 'Mag', dailyMg: 200, monthlyEur: 9.5 } as const;
    expect(encodeStack([entry({ ...shape })])).toBe(encodeStack([entry({ ...shape })]));
  });

  it('mints a fresh, unique id for every decoded entry', () => {
    const s = encodeStack([entry({ name: 'a', dailyMg: 1 }), entry({ name: 'b', dailyMg: 2 })]);
    const decoded = decodeStack(s);
    const ids = decoded.map((e) => e.id);
    expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(2);
    // And a second decode of the same URL must not reuse them.
    expect(new Set([...ids, ...decodeStack(s).map((e) => e.id)]).size).toBe(4);
  });

  it('newEntryId returns distinct ids on repeated calls', () => {
    const ids = Array.from({ length: 200 }, () => newEntryId());
    expect(new Set(ids).size).toBe(200);
  });
});

describe('decodeStack — links shared before entry ids existed', () => {
  /**
   * FROZEN FIXTURE. Do NOT regenerate this with encodeStack — that would make the
   * test circular. It is a literal share URL payload in the pre-id wire format:
   *   [["magnesium","Magnesium glycinate",200,9.5],[null,"Multivit Forte",500,12]]
   * If a change to the wire format breaks this, old links in the wild are broken too.
   */
  const LEGACY =
    'W1sibWFnbmVzaXVtIiwiTWFnbmVzaXVtIGdseWNpbmF0ZSIsMjAwLDkuNV0sW251bGwsIk11bHRpdml0IEZvcnRlIiw1MDAsMTJdXQ';

  it('still decodes a link encoded before the id refactor', () => {
    const decoded = decodeStack(LEGACY);
    expect(decoded.map(({ id, ...rest }) => rest)).toEqual([
      { compoundId: 'magnesium', name: 'Magnesium glycinate', dailyMg: 200, monthlyEur: 9.5 },
      { compoundId: null, name: 'Multivit Forte', dailyMg: 500, monthlyEur: 12 },
    ]);
  });

  it('gives those legacy entries fresh ids so they are individually removable', () => {
    const decoded = decodeStack(LEGACY);
    expect(new Set(decoded.map((e) => e.id)).size).toBe(2);
  });

  it('re-encodes a legacy link to the identical payload — the wire format has not drifted', () => {
    expect(encodeStack(decodeStack(LEGACY))).toBe(LEGACY);
  });

  it('accepts a payload with padding stripped, as encodeStack emits', () => {
    expect(LEGACY.endsWith('=')).toBe(false);
    expect(decodeStack(LEGACY)).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Hostile / malformed input. Nothing here may throw into the island: the island
// calls decodeStack in a useState initialiser, so a throw is a blank page.
// ---------------------------------------------------------------------------

describe('decodeStack — malformed input never throws', () => {
  const cases: [string, string][] = [
    ['empty string', ''],
    ['whitespace', '   '],
    ['a single character', 'x'],
    ['invalid base64 alphabet', '!!!not base64!!!'],
    ['base64 of a length that cannot decode', 'W1sibWFnbmVzaXV'.slice(0, 13) + 'A'],
    ['truncated valid payload', 'W1sibWFnbmVzaXVtIiwiTWFnbmVzaXVtIGdseWNpbmF0ZSIsMjAwLDku'],
    ['valid base64 that is not JSON', craft('this is not json at all')],
    ['valid base64 of empty text', craft('')],
    ['JSON object instead of an array', craft('{"a":1}')],
    ['JSON string instead of an array', craft('"hello"')],
    ['JSON null', craft('null')],
    ['JSON number', craft('42')],
    ['JSON true', craft('true')],
    ['array of scalars', craft('[1,2,3]')],
    ['array of objects', craft('[{"name":"x","dailyMg":1}]')],
    ['array of nulls', craft('[null,null]')],
    ['tuple with a numeric name', craft('[[null,42,100,0]]')],
    ['tuple with a string dose', craft('[[null,"x","100",0]]')],
    ['tuple that is too short', craft('[[null,"x"]]')],
    ['nested arrays', craft('[[[["x"]]]]')],
    ['deeply repeated payload', craft('[' + '[null,"x",1,0],'.repeat(200).slice(0, -1) + ']')],
    ['a JSON bomb of long strings', craft(JSON.stringify([[null, 'a'.repeat(5000), 1, 0]]))],
  ];

  it.each(cases)('does not throw on %s', (_label, input) => {
    expect(() => decodeStack(input)).not.toThrow();
  });

  it.each(cases.filter(([label]) => !label.includes('repeated') && !label.includes('bomb')))(
    'returns an empty stack for %s',
    (_label, input) => {
      expect(decodeStack(input)).toEqual([]);
    },
  );

  it('always returns an array, whatever it is handed', () => {
    for (const [, input] of cases) expect(Array.isArray(decodeStack(input))).toBe(true);
  });

  it('drops only the invalid tuples and keeps the valid ones', () => {
    const decoded = decodeStack(craft('[[null,"good",100,0],null,[1,2,3],[null,"also good",50,0],"x"]'));
    expect(decoded.map((e) => e.name)).toEqual(['good', 'also good']);
  });

  it('coerces a non-string compound id to null rather than trusting it', () => {
    const decoded = decodeStack(craft('[[42,"x",100,0]]'));
    expect(decoded).toHaveLength(1);
    expect(decoded[0]!.compoundId).toBeNull();
  });

  it('never produces an entry whose name is not a string', () => {
    for (const [, input] of cases) {
      for (const e of decodeStack(input)) expect(typeof e.name).toBe('string');
    }
  });
});

// ---------------------------------------------------------------------------
// FIXED BUGS — regression cover. These three were live defects until decodeStack
// began validating every tuple field by value; the crafted payloads that proved
// them are kept verbatim in the comments below. Nothing here may be weakened:
// each one is a share URL that put a value into StackEntry its type forbids.
// ---------------------------------------------------------------------------

describe('decodeStack — hostile numbers and types (fixed bugs, see comments)', () => {
  /**
   * BUG 1 (fixed) — decodeStack did not validate the fourth tuple field.
   *
   * The filter checked `typeof p[1] === 'string' && typeof p[2] === 'number'` and said
   * nothing about p[3], so a crafted share URL put an arbitrary JSON value into
   * StackEntry.monthlyEur, which is typed `number | undefined`.
   *
   * Payload that broke it: ?s=W1tudWxsLCJ4IiwxMDAsImV2aWwiXV0
   *   -> [[null,"x",100,"evil"]] -> { monthlyEur: "evil" }
   *
   * Downstream, analyzeStack does `a + (e.monthlyEur ?? 0)` starting from 0, so the
   * line's monthlyEur became the STRING "0evil" and the island's total "00evil".
   * Observed consequence (nothing threw, nothing attacker-controlled was rendered):
   *   - `monthlyEur > 0` is false for the string, so the "EUR x/month total" line and
   *     the per-line "EUR x/month on a grade-B compound" note silently DISAPPEARED;
   *   - the sort comparator `b.monthlyEur - a.monthlyEur` returned NaN, so line order
   *     became arbitrary.
   * A shared link could therefore make real costs vanish from someone else's screen.
   * decodeStack now reads any cost that is not a usable positive number as absent.
   */
  it('BUG 1: rejects a non-numeric monthly cost from a crafted URL', () => {
    const decoded = decodeStack(craft('[[null,"x",100,"evil"]]'));
    for (const e of decoded) {
      expect(e.monthlyEur === undefined || typeof e.monthlyEur === 'number').toBe(true);
    }
  });

  it('BUG 1 (consequence): a crafted cost cannot corrupt the merged euro total', () => {
    const lines = analyzeStack(decodeStack(craft('[[null,"x",100,"evil"]]')), GUIDES);
    for (const l of lines) expect(Number.isFinite(l.monthlyEur)).toBe(true);
  });

  /**
   * BUG 2 (fixed) — decodeStack accepted non-finite and negative doses.
   *
   * `typeof p[2] === 'number'` is true for Infinity, which JSON.parse produces from
   * the literal 1e999, and for negatives.
   *
   * Payload that broke it: ?s=W1tudWxsLCJ4IiwxZTk5OSwwXV0
   *   -> [[null,"x",1e999,0]] -> { dailyMg: Infinity }
   *
   * The island rendered "Infinity mg/day" (or "Infinity g/day"), and with a UL guide
   * the verdict was a confident OVER THE UPPER LIMIT for a dose that does not exist.
   * A negative dose (?s=W1tudWxsLCJ4IiwtNTAwLDBdXQ) silently cancelled out a real one
   * in the merged total, which is the worse case: it could hide a genuine overdose.
   * A tuple whose dose is non-finite or negative is now dropped whole — a dose is not
   * repairable, and clamping a negative to zero would leave a phantom entry on the line.
   */
  it('BUG 2: rejects a non-finite dose from a crafted URL', () => {
    const decoded = decodeStack(craft('[[null,"x",1e999,0]]'));
    for (const e of decoded) expect(Number.isFinite(e.dailyMg)).toBe(true);
  });

  it('BUG 2: rejects a negative dose from a crafted URL', () => {
    const decoded = decodeStack(craft('[[null,"x",-500,0]]'));
    for (const e of decoded) expect(e.dailyMg).toBeGreaterThan(0);
  });

  it('BUG 2 (consequence): a negative dose cannot cancel a real one in the merged total', () => {
    const lines = analyzeStack(decodeStack(craft('[["magnesium","a",400,0],["magnesium","b",-400,0]]')), GUIDES);
    expect(lines[0]!.totalMg).toBe(400);
    expect(lines[0]!.verdict).toBe('over-ul');
  });

  // These two are NOT bugs — they pass, and pin the parts of the guard that do work.
  it('does reject a non-numeric dose', () => {
    expect(decodeStack(craft('[[null,"x","100",0]]'))).toEqual([]);
  });

  it('does reject a non-string name', () => {
    expect(decodeStack(craft('[[null,null,100,0]]'))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Pasted-list parsing.
//
// The governing constraint is that a mis-parse is worse than a rejection: this
// tool tells people they are over an upper limit, so a line that quietly becomes
// the wrong number, or that quietly disappears, is the failure that matters.
// Every test below is therefore either "this exact number" or "this is refused".
// ---------------------------------------------------------------------------

/** Modelled on the real register: names with digits, slashes, parentheses, an apostrophe. */
const MATCHERS: CompoundMatcher[] = [
  {
    compoundId: 'magnesium',
    name: 'Magnesium',
    synonyms: ['magnesium oxide', 'magnesium citrate', 'magnesium glycinate'],
  },
  { compoundId: 'creatine', name: 'Creatine', synonyms: ['creatine monohydrate', 'creatine HCl'] },
  { compoundId: 'omega-3', name: 'Omega-3 (EPA/DHA)', synonyms: ['fish oil', 'EPA', 'DHA', 'icosapent ethyl'] },
  { compoundId: 'vitamin-d', name: 'Vitamin D', synonyms: ['cholecalciferol', 'D3', 'calcifediol'] },
  { compoundId: 'lions-mane', name: "Lion's mane", synonyms: ['Hericium erinaceus', 'yamabushitake'] },
  { compoundId: 'nr-nmn', name: 'NR / NMN', synonyms: ['nicotinamide riboside', 'nicotinamide mononucleotide'] },
  { compoundId: 'coq10', name: 'CoQ10', synonyms: ['coenzyme Q10', 'ubiquinone', 'ubiquinol'] },
  { compoundId: 'l-theanine', name: 'L-theanine', synonyms: ['theanine'] },
];

const parse = (text: string, matchers: CompoundMatcher[] = MATCHERS) => parseStackPaste(text, matchers);

const one = (line: string, matchers: CompoundMatcher[] = MATCHERS): PasteResult => {
  const results = parse(line, matchers);
  expect(results).toHaveLength(1);
  return results[0]!;
};

const parsed = (line: string, matchers: CompoundMatcher[] = MATCHERS) => {
  const r = one(line, matchers);
  if (r.status !== 'parsed') throw new Error(`expected "${line}" to parse, got: ${r.reason}`);
  return r;
};

const rejected = (line: string, matchers: CompoundMatcher[] = MATCHERS) => {
  const r = one(line, matchers);
  if (r.status !== 'rejected') throw new Error(`expected "${line}" to be refused, got ${r.dailyMg} mg`);
  return r;
};

describe('parseStackPaste — units and the exact mg they produce', () => {
  it('reads mg with and without a space', () => {
    expect(parsed('magnesium 400mg').dailyMg).toBe(400);
    expect(parsed('magnesium 400 mg').dailyMg).toBe(400);
    expect(parsed('magnesium 400 MG').dailyMg).toBe(400);
    expect(parsed('magnesium 400 milligrams').dailyMg).toBe(400);
  });

  it('converts grams to mg', () => {
    expect(parsed('Creatine 5 g').dailyMg).toBe(5000);
    expect(parsed('Creatine 5g').dailyMg).toBe(5000);
    expect(parsed('Creatine 5 grams').dailyMg).toBe(5000);
  });

  it('converts a fractional gram without floating-point litter', () => {
    expect(parsed('Creatine 1.1 g').dailyMg).toBe(1100);
    expect(parsed('Creatine 2.5 g').dailyMg).toBe(2500);
    expect(parsed('Creatine 0.5 g').dailyMg).toBe(500);
  });

  it('converts micrograms, spelled every way a label spells them', () => {
    expect(parsed('Vitamin D 25 mcg').dailyMg).toBe(0.025);
    expect(parsed('Vitamin D 25 ug').dailyMg).toBe(0.025);
    expect(parsed('Vitamin D 25 µg').dailyMg).toBe(0.025); // MICRO SIGN
    expect(parsed('Vitamin D 25 μg').dailyMg).toBe(0.025); // GREEK SMALL LETTER MU
    expect(parsed('Vitamin D 25 micrograms').dailyMg).toBe(0.025);
  });

  it('refuses a unit it cannot convert, and names the unit', () => {
    expect(rejected('Magnesium 2 caps').reason).toContain('"caps"');
    expect(rejected('Fish oil 5 ml').reason).toContain('"ml"');
    expect(rejected('Creatine 1 scoop').reason).toContain('"scoop"');
  });

  it('refuses a dose with no unit at all', () => {
    expect(rejected('magnesium 400').reason).toContain('no unit');
    expect(rejected('Creatine 5').reason).toContain('no unit');
  });
});

describe('parseStackPaste — the dose is anchored at the end, so digits in names are safe', () => {
  it('does not read the digit inside a compound name as the dose', () => {
    expect(parsed('omega-3 1000 mg').dailyMg).toBe(1000);
    expect(parsed('CoQ10 100 mg').dailyMg).toBe(100);
    expect(parsed('Vitamin B12 1000 mcg').dailyMg).toBe(1);
    expect(parsed('5-HTP 100 mg').dailyMg).toBe(100);
  });

  it('keeps the whole name, digits included', () => {
    expect(parsed('omega-3 1000 mg').name).toBe('omega-3');
    expect(parsed('CoQ10 100 mg').name).toBe('CoQ10');
    expect(parsed('Vitamin B12 1000 mcg').name).toBe('Vitamin B12');
  });

  it('refuses a line whose dose is in the middle rather than at the end', () => {
    expect(rejected('Creatine 5 g monohydrate').status).toBe('rejected');
    expect(rejected('Fish oil 1000 mg (300 EPA)').status).toBe('rejected');
  });
});

describe('parseStackPaste — matching against register names and synonyms', () => {
  it('matches the register name, case- and space-insensitively', () => {
    expect(parsed('magnesium 400 mg').compoundId).toBe('magnesium');
    expect(parsed('MAGNESIUM 400 mg').compoundId).toBe('magnesium');
    expect(parsed('  Magnesium   400 mg').compoundId).toBe('magnesium');
  });

  it('matches a synonym', () => {
    expect(parsed('magnesium glycinate 400 mg').compoundId).toBe('magnesium');
    expect(parsed('creatine monohydrate 5 g').compoundId).toBe('creatine');
    expect(parsed('fish oil 1000 mg').compoundId).toBe('omega-3');
    expect(parsed('ubiquinol 100 mg').compoundId).toBe('coq10');
    expect(parsed('theanine 200 mg').compoundId).toBe('l-theanine');
  });

  it('reports the register name for a match, and the typed name as the entry name', () => {
    const r = parsed('fish oil 1000 mg');
    expect(r.matchedName).toBe('Omega-3 (EPA/DHA)');
    expect(r.name).toBe('fish oil');
  });

  it('matches a display name stripped of its parenthetical suffix', () => {
    expect(parsed('Omega-3 1000 mg').compoundId).toBe('omega-3');
    expect(parsed('Omega-3 (EPA/DHA) 1000 mg').compoundId).toBe('omega-3');
  });

  it('matches either side of a slashed register name', () => {
    expect(parsed('NMN 500 mg').compoundId).toBe('nr-nmn');
    expect(parsed('NR 300 mg').compoundId).toBe('nr-nmn');
  });

  it('matches across an apostrophe', () => {
    expect(parsed("Lion's mane 1 g").compoundId).toBe('lions-mane');
    expect(parsed('lions mane 1 g').compoundId).toBe('lions-mane');
    expect(parsed('LIONS MANE 1 g').compoundId).toBe('lions-mane');
  });

  it('matches a name written without its separator', () => {
    expect(parsed('omega3 1000 mg').compoundId).toBe('omega-3');
    expect(parsed('ltheanine 200 mg').compoundId).toBe('l-theanine');
    expect(parsed('coenzymeQ10 100 mg').compoundId).toBe('coq10');
  });

  it('matches "Vitamin " + a synonym, the way a label writes it', () => {
    expect(parsed('Vitamin D3 25 mcg').compoundId).toBe('vitamin-d');
    expect(parsed('D3 25 mcg').compoundId).toBe('vitamin-d');
    expect(parsed('cholecalciferol 25 mcg').compoundId).toBe('vitamin-d');
  });

  it('leaves a spelling two compounds both claim unmatched rather than picking one', () => {
    const ambiguous: CompoundMatcher[] = [
      { compoundId: 'a', name: 'Alpha', synonyms: ['shared name'] },
      { compoundId: 'b', name: 'Beta', synonyms: ['shared name'] },
    ];
    const r = parsed('shared name 100 mg', ambiguous);
    expect(r.compoundId).toBeNull();
    expect(r.matchedName).toBeNull();
    expect(r.dailyMg).toBe(100);
  });

  it('does no substring or fuzzy matching', () => {
    // "mag" is not magnesium and "creatine gummies" is not creatine: a wrong match
    // is a wrong upper-limit verdict, so a near miss stays unmatched.
    expect(parsed('mag 400 mg').compoundId).toBeNull();
    expect(parsed('creatine gummies 5 g').compoundId).toBeNull();
    expect(parsed('magnesium-rich multivit 400 mg').compoundId).toBeNull();
  });
});

describe('parseStackPaste — unmatched names are still added', () => {
  it('parses a name the register has never heard of, with compoundId null', () => {
    const r = parsed('Multivit Forte 500 mg');
    expect(r.compoundId).toBeNull();
    expect(r.matchedName).toBeNull();
    expect(r.name).toBe('Multivit Forte');
    expect(r.dailyMg).toBe(500);
  });

  it('an unmatched pasted entry still counts toward the stack it is added to', () => {
    const r = parsed('Multivit Forte 500 mg');
    const lines = analyzeStack(
      [{ id: newEntryId(), compoundId: r.compoundId, name: r.name, dailyMg: r.dailyMg }],
      GUIDES,
    );
    expect(lines[0]!.totalMg).toBe(500);
    expect(lines[0]!.verdict).toBe('no-data');
  });

  it('parses everything when the register is empty', () => {
    const r = parsed('magnesium 400 mg', []);
    expect(r.compoundId).toBeNull();
    expect(r.dailyMg).toBe(400);
  });
});

describe('parseStackPaste — IU is refused, never converted', () => {
  it('refuses an IU line for a matched compound and says why, naming the compound', () => {
    const r = rejected('Vitamin D 2000 IU');
    expect(r.reason).toContain('IU is not a mass');
    expect(r.reason).toContain('Vitamin D');
  });

  it('refuses an IU line for an unmatched name too', () => {
    expect(rejected('Vitamin E 400 IU').reason).toContain('IU is not a mass');
    expect(rejected('Some Brand 1000 iu').reason).toContain('IU is not a mass');
  });

  it('refuses "I.U." written with stops', () => {
    expect(rejected('Vitamin D 2000 I.U.').reason).toContain('IU is not a mass');
  });

  it('refuses "IE", which is how a Dutch or German label writes IU', () => {
    expect(rejected('Vitamin D 800 IE').reason).toContain('IU is not a mass');
    expect(rejected('Vitamine D 800 ie').reason).toContain('IU is not a mass');
    expect(rejected('Vitamin D 800 I.E.').reason).toContain('IU is not a mass');
  });

  it('never produces an entry from an IU line, whatever the compound', () => {
    const text = 'Vitamin D 2000 IU\nVitamin E 400 IU\nVitamin A 5000 IU\nmagnesium 400 mg';
    const kept = parse(text).filter((r) => r.status === 'parsed');
    expect(kept).toHaveLength(1);
    expect(kept[0]).toMatchObject({ compoundId: 'magnesium' });
  });
});

describe('parseStackPaste — numbers that must not be guessed at', () => {
  it('refuses a comma in the dose rather than picking a locale', () => {
    // "1,5" is 1.5 in Brussels; "1,000" is a thousand in London. Both refused.
    expect(rejected('Creatine 1,5 g').reason).toContain('comma');
    expect(rejected('magnesium 1,000 mg').reason).toContain('comma');
  });

  it('refuses zero', () => {
    expect(rejected('magnesium 0 mg').reason).toContain('more than zero');
    expect(rejected('magnesium 0.0 mg').reason).toContain('more than zero');
  });

  it('refuses a dose welded to a dash or sign, which would silently lose the sign', () => {
    expect(rejected('magnesium -400 mg').status).toBe('rejected');
    expect(rejected('magnesium-400mg').status).toBe('rejected');
    expect(rejected('magnesium +400 mg').status).toBe('rejected');
  });

  it('refuses a bare leading decimal point, which would read ".4 g" as 4 g', () => {
    expect(rejected('Magnesium .4 g').status).toBe('rejected');
    expect(rejected('Creatine .5g').status).toBe('rejected');
  });

  it('refuses an exponent, which would read "4e2 mg" as 2 mg', () => {
    expect(rejected('Magnesium 4e2 mg').status).toBe('rejected');
    expect(rejected('Magnesium 1e999 mg').status).toBe('rejected');
  });

  it('refuses a dot that could be a thousands separator, but keeps real sub-mg doses', () => {
    // "1.000 mg" is 1 mg in London and 1000 mg in Berlin — a factor of a thousand
    // on the one number the upper-limit verdict is computed from.
    expect(rejected('Magnesium 1.000 mg').reason).toContain('thousands separator');
    expect(rejected('Creatine 2.500 g').reason).toContain('thousands separator');
    expect(parsed('Vitamin D 0.025 mg').dailyMg).toBe(0.025);
    expect(parsed('Vitamin D 0.500 mg').dailyMg).toBe(0.5);
    expect(parsed('Creatine 1.5 g').dailyMg).toBe(1500);
    expect(parsed('Creatine 1.25 g').dailyMg).toBe(1250);
  });

  it('accepts a spaced dash as a separator and drops it from the name', () => {
    const r = parsed('Magnesium - 400 mg');
    expect(r.dailyMg).toBe(400);
    expect(r.name).toBe('Magnesium');
    expect(r.compoundId).toBe('magnesium');
  });

  it('refuses a multiplier instead of quietly taking one of the two numbers', () => {
    expect(rejected('Magnesium 2 x 200 mg').reason).toContain('multiplier');
    expect(rejected('2 x Magnesium 200 mg').reason).toContain('multiplier');
    expect(rejected('Magnesium 400 mg x 2').reason).toContain('multiplier');
    expect(rejected('Magnesium 400mg x2').reason).toContain('multiplier');
  });

  it('refuses two doses on one line instead of taking the last one', () => {
    expect(rejected('Vitamin D 1000 IU + K2 100 mcg').reason).toContain('more than one dose');
    expect(rejected('magnesium 400mg, creatine 5g').reason).toContain('more than one dose');
  });

  it('refuses a dose with no name in front of it', () => {
    expect(rejected('400 mg').reason).toContain('no name');
    expect(rejected('.5 g').reason).toContain('no name');
  });

  it('refuses a name with no dose', () => {
    expect(rejected('magnesium').status).toBe('rejected');
    expect(rejected('Vitamin B12').status).toBe('rejected');
    expect(rejected('Omega 3').status).toBe('rejected');
  });
});

describe('parseStackPaste — real-paste decoration', () => {
  it('reads a bulleted or numbered list', () => {
    const results = parse('- magnesium 400 mg\n* Creatine 5 g\n• fish oil 1000 mg\n1. theanine 200 mg');
    expect(results.map((r) => (r.status === 'parsed' ? r.compoundId : r.reason))).toEqual([
      'magnesium',
      'creatine',
      'omega-3',
      'l-theanine',
    ]);
  });

  it('reads a trailing per-day qualifier', () => {
    expect(parsed('Creatine 5 g/day').dailyMg).toBe(5000);
    expect(parsed('Creatine 5 g / day').dailyMg).toBe(5000);
    expect(parsed('Creatine 5 g per day').dailyMg).toBe(5000);
    expect(parsed('Creatine 5 g daily').dailyMg).toBe(5000);
    expect(parsed('Creatine 5g/d').dailyMg).toBe(5000);
  });

  it('reads a line ending in a full stop or a comma', () => {
    expect(parsed('magnesium 400 mg.').dailyMg).toBe(400);
    expect(parsed('magnesium 400 mg,').dailyMg).toBe(400);
  });

  it('drops a trailing separator from the name it stores', () => {
    expect(parsed('Magnesium: 400 mg').name).toBe('Magnesium');
    expect(parsed('Magnesium, 400 mg').name).toBe('Magnesium');
  });

  it('handles CRLF line endings, as a paste from Windows carries', () => {
    const results = parse('magnesium 400 mg\r\nCreatine 5 g\r\n');
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.status === 'parsed')).toBe(true);
  });
});

describe('parseStackPaste — whole blocks', () => {
  it('skips blank lines silently and returns one result per non-blank line, in order', () => {
    const results = parse('\n\nmagnesium 400 mg\n   \nCreatine 5 g\n\n');
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.raw)).toEqual(['magnesium 400 mg', 'Creatine 5 g']);
  });

  it('keeps every non-blank line: nothing is silently dropped', () => {
    const lines = ['magnesium 400 mg', 'Vitamin D 2000 IU', 'not a supplement at all', 'Creatine 5 g'];
    const results = parse(lines.join('\n'));
    expect(results).toHaveLength(4);
    expect(results.map((r) => r.raw)).toEqual(lines);
    expect(results.map((r) => r.status)).toEqual(['parsed', 'rejected', 'rejected', 'parsed']);
  });

  it('keeps the raw line on a rejection, so the user can see what was refused', () => {
    expect(rejected('  Vitamin D 2000 IU  ').raw).toBe('Vitamin D 2000 IU');
  });

  it('gives every rejection a non-empty reason', () => {
    const text =
      'magnesium\n400 mg\nmagnesium 0 mg\nmagnesium 1,5 g\nVitamin D 2000 IU\nMagnesium 2 x 200 mg\nmagnesium 3 scoops';
    for (const r of parse(text)) {
      expect(r.status).toBe('rejected');
      if (r.status === 'rejected') expect(r.reason.length).toBeGreaterThan(0);
    }
  });

  it('keeps duplicate lines as separate results — merging is analyzeStack’s job, not the parser’s', () => {
    const results = parse('magnesium 200 mg\nmagnesium 200 mg\nMagnesium glycinate 200 mg');
    expect(results).toHaveLength(3);
    expect(results.every((r) => r.status === 'parsed' && r.compoundId === 'magnesium')).toBe(true);
  });

  it('three pasted magnesium lines stay separately removable and cross the UL together', () => {
    const entries: StackEntry[] = parse('magnesium 200 mg\nmagnesium 200 mg\nMultivit 100 mg')
      .filter((r): r is Extract<PasteResult, { status: 'parsed' }> => r.status === 'parsed')
      .map((r) => ({ id: newEntryId(), compoundId: r.compoundId, name: r.name, dailyMg: r.dailyMg }));
    expect(entries).toHaveLength(3);
    expect(new Set(entries.map((e) => e.id)).size).toBe(3);

    const lines = analyzeStack(entries, GUIDES);
    const mag = lines.find((l) => l.compoundId === 'magnesium')!;
    expect(mag.totalMg).toBe(400);
    expect(mag.duplicated).toBe(true);
    expect(mag.sources).toHaveLength(2);
    expect(mag.verdict).toBe('over-ul');
  });

  it('is deterministic and does not mutate its inputs', () => {
    const text = 'magnesium 400 mg\nVitamin D 2000 IU\nMultivit 500 mg';
    const matchers = structuredClone(MATCHERS);
    expect(parse(text, matchers)).toEqual(parse(text, matchers));
    expect(matchers).toEqual(MATCHERS);
  });

  it('returns an empty list for empty or whitespace-only text', () => {
    expect(parse('')).toEqual([]);
    expect(parse('   \n\t\n  ')).toEqual([]);
  });

  it('never returns a parsed line whose dose is not a finite number above zero', () => {
    const text = [
      'magnesium 400 mg', 'Creatine 5 g', 'Vitamin D 25 mcg', 'Vitamin D 2000 IU',
      'magnesium 0 mg', 'magnesium -400 mg', 'magnesium 1,000 mg', 'magnesium 400',
      '400 mg', 'magnesium', '', '   ', 'Magnesium 2 x 200 mg', 'x', '---', '1e999 mg',
      'magnesium 1e999 mg', 'magnesium 999999999 g', 'magnesium 0.0000001 mcg',
    ].join('\n');
    for (const r of parse(text)) {
      if (r.status !== 'parsed') continue;
      expect(Number.isFinite(r.dailyMg)).toBe(true);
      expect(r.dailyMg).toBeGreaterThan(0);
      expect(typeof r.name).toBe('string');
      expect(r.name.length).toBeGreaterThan(0);
    }
  });
});
