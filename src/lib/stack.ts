/**
 * Stack overlap checker logic. Pure functions so the island stays thin and the
 * math is testable. Doses are milligrams of elemental/active compound per day.
 */
import type { Grade } from './grades';

/** One line the user added: a product or a raw compound + dose. */
export interface StackEntry {
  /**
   * Stable per-entry id, so two entries of the same compound stay separable.
   * Session-local: never serialised into the share URL, regenerated on decode.
   */
  id: string;
  /** Register compound id when matched; null for unknown compounds. */
  compoundId: string | null;
  /** Display name as entered (product or compound). */
  name: string;
  /** Elemental/active dose per day, mg. */
  dailyMg: number;
  /** Cost per month in euros, optional. */
  monthlyEur?: number;
}

/** Per-compound dose guide from the register, used for comparisons. */
export interface DoseGuide {
  compoundId: string;
  name: string;
  /** Grade of the best-supported claim, for the "€/month on grade D" line. */
  bestGrade: Grade;
  bestClaim: string;
  studiedMinMg?: number;
  studiedMaxMg?: number;
  ulMg?: number;
  /** Alternative spellings from the register, so a pasted list can be matched. */
  synonyms?: string[];
}

export type DoseVerdict = 'over-ul' | 'under-studied' | 'in-range' | 'no-data';

let idCounter = 0;

/** Fresh id for a stack entry. No dependency: uuid where available, counter otherwise. */
export function newEntryId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `e${++idCounter}-${Date.now().toString(36)}`;
}

export interface StackLine {
  /** Identity of the merged group, for list keys. */
  groupKey: string;
  compoundId: string | null;
  name: string;
  totalMg: number;
  /** Every entry feeding this line, so one source can be removed on its own. */
  sources: { id: string; name: string }[];
  duplicated: boolean;
  verdict: DoseVerdict;
  guide: DoseGuide | null;
  monthlyEur: number;
}

export function analyzeStack(entries: StackEntry[], guides: Record<string, DoseGuide>): StackLine[] {
  const byKey = new Map<string, StackEntry[]>();
  for (const e of entries) {
    const key = e.compoundId ?? `unknown:${e.name.trim().toLowerCase()}`;
    const list = byKey.get(key) ?? [];
    list.push(e);
    byKey.set(key, list);
  }

  const lines: StackLine[] = [];
  for (const [key, group] of byKey) {
    const compoundId = key.startsWith('unknown:') ? null : key;
    const guide = compoundId ? (guides[compoundId] ?? null) : null;
    const totalMg = group.reduce((a, e) => a + e.dailyMg, 0);
    const monthlyEur = group.reduce((a, e) => a + (e.monthlyEur ?? 0), 0);

    let verdict: DoseVerdict = 'no-data';
    if (guide) {
      if (guide.ulMg !== undefined && totalMg > guide.ulMg) verdict = 'over-ul';
      else if (guide.studiedMinMg !== undefined && totalMg < guide.studiedMinMg / 2) verdict = 'under-studied';
      else if (guide.studiedMinMg !== undefined || guide.ulMg !== undefined) verdict = 'in-range';
    }

    lines.push({
      groupKey: key,
      compoundId,
      name: guide?.name ?? group[0]!.name,
      totalMg,
      sources: group.map((e) => ({ id: e.id, name: e.name })),
      duplicated: group.length > 1,
      verdict,
      guide,
      monthlyEur,
    });
  }

  lines.sort((a, b) => Number(b.duplicated) - Number(a.duplicated) || b.monthlyEur - a.monthlyEur);
  return lines;
}

/*
 * Shareable-URL state: compact JSON → base64url in ?s=
 * The packed tuple is the wire format — four fields, in this order. Entry ids are
 * deliberately absent and are minted again on decode, so old links keep working.
 */

type Packed = [string | null, string, number, number][];

export function encodeStack(entries: StackEntry[]): string {
  const packed: Packed = entries.map((e) => [e.compoundId, e.name, e.dailyMg, e.monthlyEur ?? 0]);
  const json = JSON.stringify(packed);
  return btoa(String.fromCharCode(...new TextEncoder().encode(json)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}

/**
 * A share URL is untrusted input: anyone can hand-craft the ?s= payload. Every
 * field is checked by value, not just by `typeof`, on this rule:
 *
 *   - fields with a meaningful "absent" value are coerced to it — a compound id
 *     that is not a string becomes null (unmatched), a cost that is not a usable
 *     number becomes undefined (no cost given);
 *   - fields the entry cannot exist without — the name, and the dose the whole
 *     verdict is computed from — have no safe default, so a tuple carrying a bad
 *     one is dropped entirely rather than repaired.
 *
 * A negative dose is dropped under the second rule, not clamped to zero: it would
 * otherwise subtract from the merged total and hide a genuine overdose behind an
 * in-range verdict, which is the one thing this tool exists to catch.
 */
export function decodeStack(s: string): StackEntry[] {
  try {
    const b64 = s.replaceAll('-', '+').replaceAll('_', '/');
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const packed = JSON.parse(new TextDecoder().decode(bytes)) as Packed;
    return packed
      .filter(
        (p) =>
          Array.isArray(p) &&
          typeof p[1] === 'string' &&
          typeof p[2] === 'number' &&
          Number.isFinite(p[2]) &&
          p[2] >= 0,
      )
      .map(([compoundId, name, dailyMg, monthlyEur]) => ({
        id: newEntryId(),
        compoundId: typeof compoundId === 'string' ? compoundId : null,
        name,
        dailyMg,
        // Optional on the wire: encodeStack writes 0 when there is no cost. Anything
        // that is not a usable positive number — a string, Infinity, a negative —
        // reads as "no cost", so it can never corrupt the summed euro total.
        monthlyEur:
          typeof monthlyEur === 'number' && Number.isFinite(monthlyEur) && monthlyEur > 0 ? monthlyEur : undefined,
      }));
  } catch {
    return [];
  }
}

/*
 * Pasted-list parsing.
 *
 * This lives in the library rather than the island because of what it is for: a
 * tool whose job is to say "you are over the upper limit" must never turn a typed
 * line into the wrong number. That is a property worth testing, and an island is
 * not testable. The parser is pure and deterministic — same text in, same result
 * out — so the island can re-run it on every keystroke to show a preview.
 *
 * The governing rule everywhere below: a line is either understood exactly, or it
 * is rejected out loud with a reason. Nothing is guessed and nothing is dropped
 * in silence. Only blank lines disappear, because a blank line is not content.
 */

/** A register compound a pasted name can be matched against. */
export interface CompoundMatcher {
  compoundId: string;
  name: string;
  synonyms?: string[];
}

/** One pasted line, either understood or refused. `parsed` carries no id: the caller mints one. */
export type PasteResult =
  | {
      status: 'parsed';
      /** The line as pasted, trimmed — shown next to the result. */
      raw: string;
      /** Register id when the name matched, null when it did not. */
      compoundId: string | null;
      /** Name as written, cleaned of bullets and trailing separators. */
      name: string;
      dailyMg: number;
      /** The register's own name for the match, for "→ Magnesium". Null when unmatched. */
      matchedName: string | null;
    }
  | { status: 'rejected'; raw: string; reason: string };

/** Units this tool can convert to mg. IU is deliberately absent — see below. */
const MASS_UNITS: Record<string, 'mg' | 'g' | 'mcg'> = {
  mg: 'mg',
  mgs: 'mg',
  milligram: 'mg',
  milligrams: 'mg',
  g: 'g',
  gram: 'g',
  grams: 'g',
  gramme: 'g',
  grammes: 'g',
  mcg: 'mcg',
  mcgs: 'mcg',
  ug: 'mcg',
  'µg': 'mcg', // MICRO SIGN
  'μg': 'mcg', // GREEK SMALL LETTER MU — both occur in pasted text
  microgram: 'mcg',
  micrograms: 'mcg',
};

/**
 * IU is a unit of biological activity, not of mass, and the factor is different
 * for every compound (vitamin D and vitamin E do not share one). The register
 * carries no IU factors, so converting one here would mean inventing a number —
 * and an invented factor produces a confident, wrong verdict against an upper
 * limit. IU lines are refused instead.
 */
const IU_UNITS = new Set(['iu', 'ius', 'ie']); // "IE" is IU on a Dutch or German label

/** A second dose left inside the name: "Vitamin D 1000 IU + K2 100 mcg". */
const SECOND_DOSE = /\d\s*(?:mg|g|mcg|ug|µg|μg|iu|kg|ml)\b/i;

/** A multiplier: "Magnesium 2 x 200 mg" means 400, and this tool will not assume it. */
const MULTIPLIER = /\d\s*[x×]|(?:^|[\s(])[x×]\s*\d/i;

/** The same thing written after the dose: "Magnesium 400 mg x 2". */
const TRAILING_MULTIPLIER = /[x×]\s*\d+$/i;

const MULTIPLIER_REASON =
  'this looks like a multiplier. Work out the daily total yourself and write it as one dose, e.g. "magnesium 400 mg".';

/** name, gap, number, unit — the dose is anchored to the end of the line, so a
 *  digit inside the name ("omega-3", "CoQ10", "B12") cannot be read as the dose. */
const DOSE_LINE = /^(.*?)(\s*)([0-9][0-9.,]*)\s*([A-Za-zµμ]+)$/;

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/['‘’ʼ]/g, '') // lion's mane === lions mane
    .replace(/[^a-z0-9+]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Spacing-insensitive key, so "omega3" reaches "Omega-3". */
function squashKey(s: string): string {
  return normalizeKey(s).replace(/[^a-z0-9]/g, '');
}

/** compoundId, or null for "two compounds claim this spelling" — ambiguous is unmatched. */
type KeyTier = Map<string, string | null>;

function addKey(tier: KeyTier, key: string, compoundId: string): void {
  if (!key) return;
  const seen = tier.get(key);
  if (seen === undefined) tier.set(key, compoundId);
  else if (seen !== compoundId) tier.set(key, null);
}

export interface CompoundIndex {
  /** Tried in order: exact names/synonyms, then derived spellings, then squashed. */
  tiers: KeyTier[];
  names: Map<string, string>;
}

/**
 * Exact lookup only — no substring or fuzzy matching. A wrong match is a wrong
 * upper-limit verdict, so anything not recognised stays unmatched, which the
 * checker already handles honestly (`compoundId: null` still counts toward totals).
 */
export function buildCompoundIndex(matchers: CompoundMatcher[]): CompoundIndex {
  const primary: KeyTier = new Map();
  const derived: KeyTier = new Map();
  const squashed: KeyTier = new Map();
  const names = new Map<string, string>();

  for (const m of matchers ?? []) {
    if (!m || typeof m.compoundId !== 'string' || typeof m.name !== 'string') continue;
    names.set(m.compoundId, m.name);
    const synonyms = (m.synonyms ?? []).filter((s): s is string => typeof s === 'string');
    const exact = [m.name, ...synonyms];
    for (const k of exact) addKey(primary, normalizeKey(k), m.compoundId);

    // Register names are display strings, not the spellings people type. Derive the
    // ones a paste actually contains: the parenthetical suffix dropped
    // ("Omega-3 (EPA/DHA)" -> "Omega-3"), each side of a slashed name
    // ("NR / NMN" -> "NR", "NMN"), and "Vitamin " + synonym ("Vitamin D" + "D3").
    const bare = m.name.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
    const spellings = [bare, ...bare.split('/')];
    if (/^vitamin\b/i.test(m.name)) spellings.push(...synonyms.map((s) => `vitamin ${s}`));
    for (const k of spellings) addKey(derived, normalizeKey(k), m.compoundId);

    for (const k of [...exact, ...spellings]) addKey(squashed, squashKey(k), m.compoundId);
  }

  return { tiers: [primary, derived, squashed], names };
}

function lookup(index: CompoundIndex, name: string): string | null {
  const normal = normalizeKey(name);
  const squash = squashKey(name);
  for (let i = 0; i < index.tiers.length; i++) {
    const hit = index.tiers[i]!.get(i === 2 ? squash : normal);
    if (typeof hit === 'string') return hit;
    if (hit === null) return null; // ambiguous at this tier: stop, stay unmatched
  }
  return null;
}

/** Strip list decoration and a trailing "/day", so real pastes survive. */
function tidyLine(line: string): string {
  let s = line.trim();
  s = s.replace(/^(?:[-*•·>–—]+\s*|\d+[.)]\s+)/, '');
  s = s.replace(/\s*(?:\/\s*(?:day|d)|per\s+day|a\s+day|each\s+day|daily)\s*$/i, '');
  s = s.replace(/[.,;:]+$/, '');
  s = s.replace(/(\d)\s*i\.\s*[ue]\.?\s*$/i, '$1 IU'); // "2000 I.U." / "2000 I.E." -> refused as IU, not as junk
  return s.trim();
}

function parseLine(raw: string, index: CompoundIndex): PasteResult {
  const reject = (reason: string): PasteResult => ({ status: 'rejected', raw, reason });
  const line = tidyLine(raw);
  if (!line) return reject('nothing left on the line once list punctuation was removed.');

  const m = DOSE_LINE.exec(line);
  if (!m) {
    if (TRAILING_MULTIPLIER.test(line)) return reject(MULTIPLIER_REASON);
    return reject(
      /\d\s*$/.test(line)
        ? 'a number with no unit. Write the unit: mg, g or mcg.'
        : 'no dose at the end of the line. Expected a name then a dose, like "magnesium 400 mg".',
    );
  }
  const [, rawName, gap, numText, unitText] = m as unknown as [string, string, string, string, string];

  const name = rawName.replace(/[\s:;,=\-–—]+$/, '').trim();
  if (!/[a-z0-9]/i.test(name)) return reject('a dose with no name in front of it.');

  // Anything welded to the front of the number changes what the number means and
  // the capture above cannot see it: "-400mg" loses a sign, ".4 g" loses a leading
  // decimal point and reads as 4, "4e2" reads as 2. A dash with a space around it
  // ("Magnesium - 400 mg") is just a separator and is fine.
  if (gap === '' && /(?:[-+–—.]|\d[eE])$/.test(rawName)) {
    return reject('the number runs straight onto a sign, dot or exponent. Write the dose plainly, e.g. "magnesium 400 mg".');
  }

  if (MULTIPLIER.test(name)) return reject(MULTIPLIER_REASON);
  if (SECOND_DOSE.test(name)) {
    return reject('more than one dose on the line. Put each compound on its own line.');
  }

  const compoundId = lookup(index, name);
  const matchedName = compoundId ? (index.names.get(compoundId) ?? null) : null;

  if (numText.includes(',')) {
    return reject(`"${numText}" uses a comma, which reads as 1.5 in some places and 1500 in others. Write 1.5 or 1500.`);
  }
  if (!/^\d+(?:\.\d+)?$/.test(numText)) return reject(`"${numText}" is not a number.`);
  // "1.000" is one in London and a thousand in Berlin. Exactly three decimals after a
  // non-zero whole number is that ambiguity, so it is refused — while "0.025 mg", a
  // real microgram dose written in mg, keeps working.
  if (/\.\d{3}$/.test(numText) && Number(numText.split('.')[0]) !== 0) {
    return reject(`"${numText}" could be a decimal point or a thousands separator. Write 1.5 or 1500.`);
  }
  const amount = Number(numText);
  if (!Number.isFinite(amount) || amount <= 0) return reject('a dose has to be more than zero.');

  const unit = unitText.toLowerCase();
  if (IU_UNITS.has(unit)) {
    return reject(
      matchedName
        ? `IU is not a mass, and the IU-to-mg factor differs per compound. The register holds no factor for ${matchedName}, and this tool will not guess one — enter the mg or mcg from the label.`
        : 'IU is not a mass, and the IU-to-mg factor differs per compound. Enter the mg or mcg from the label.',
    );
  }
  const kind = MASS_UNITS[unit];
  if (!kind) return reject(`"${unitText}" is not a unit this tool reads. Use mg, g or mcg.`);

  const mg = kind === 'g' ? amount * 1000 : kind === 'mcg' ? amount / 1000 : amount;
  const dailyMg = Math.round(mg * 1e6) / 1e6; // 1.1 g is 1100 mg, not 1100.0000000000002
  if (!(dailyMg > 0)) return reject('that dose rounds to zero mg.');

  return { status: 'parsed', raw, compoundId, name, dailyMg, matchedName };
}

/**
 * Parse a pasted block, one result per non-blank line, in the order pasted.
 *
 * Identical lines stay separate results and must become separate entries: two
 * products both carrying magnesium is exactly the finding this tool exists to
 * surface, and merging them at parse time would erase the second source.
 */
export function parseStackPaste(text: string, matchers: CompoundMatcher[]): PasteResult[] {
  const index = buildCompoundIndex(matchers);
  const out: PasteResult[] = [];
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const raw = line.trim();
    if (!raw) continue;
    out.push(parseLine(raw, index));
  }
  return out;
}
