/**
 * Stack overlap checker logic. Pure functions so the island stays thin and the
 * math is testable. Doses are milligrams of elemental/active compound per day.
 */
import type { Grade } from './grades';

/** One line the user added: a product or a raw compound + dose. */
export interface StackEntry {
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
}

export type DoseVerdict = 'over-ul' | 'under-studied' | 'in-range' | 'no-data';

export interface StackLine {
  compoundId: string | null;
  name: string;
  totalMg: number;
  sources: string[];
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
      compoundId,
      name: guide?.name ?? group[0]!.name,
      totalMg,
      sources: group.map((e) => e.name),
      duplicated: group.length > 1,
      verdict,
      guide,
      monthlyEur,
    });
  }

  lines.sort((a, b) => Number(b.duplicated) - Number(a.duplicated) || b.monthlyEur - a.monthlyEur);
  return lines;
}

/* Shareable-URL state: compact JSON → base64url in ?s= */

type Packed = [string | null, string, number, number][];

export function encodeStack(entries: StackEntry[]): string {
  const packed: Packed = entries.map((e) => [e.compoundId, e.name, e.dailyMg, e.monthlyEur ?? 0]);
  const json = JSON.stringify(packed);
  return btoa(String.fromCharCode(...new TextEncoder().encode(json)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}

export function decodeStack(s: string): StackEntry[] {
  try {
    const b64 = s.replaceAll('-', '+').replaceAll('_', '/');
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const packed = JSON.parse(new TextDecoder().decode(bytes)) as Packed;
    return packed
      .filter((p) => Array.isArray(p) && typeof p[1] === 'string' && typeof p[2] === 'number')
      .map(([compoundId, name, dailyMg, monthlyEur]) => ({
        compoundId: typeof compoundId === 'string' ? compoundId : null,
        name,
        dailyMg,
        monthlyEur: monthlyEur || undefined,
      }));
  } catch {
    return [];
  }
}
