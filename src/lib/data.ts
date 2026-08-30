/**
 * Build-time queries over the content collections. Everything here runs during
 * `astro build`; islands receive the plain-JSON results as props.
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import type { Grade, Effect } from './grades';
import { gradeRank } from './grades';
import type { ClaimSpecies } from './species';
import { speciesBucket } from './species';
import type { DoseGuide } from './stack';
import { costPerGramActive, FORM_FACTORS } from './cost';

export type Compound = CollectionEntry<'compounds'>;

export async function allCompounds(): Promise<Compound[]> {
  const list = await getCollection('compounds');
  return list.sort((a, b) => a.data.name.localeCompare(b.data.name));
}

export interface RegradeEvent {
  compoundId: string;
  compound: string;
  claim: string;
  from: Grade;
  to: Grade;
  date: string;
  why: string;
}

export function regradeEvents(compounds: Compound[]): RegradeEvent[] {
  return compounds
    .flatMap((c) =>
      c.data.history.map((h) => ({
        compoundId: c.id,
        compound: c.data.name,
        claim: h.claim,
        from: h.from,
        to: h.to,
        date: h.date,
        why: h.why,
      })),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Summary row for the register table island and the JSON API index. */
export interface RegisterRow {
  id: string;
  name: string;
  synonyms: string[];
  cats: string[];
  claimCats: string[];
  outcome: string;
  grade: Grade;
  effect: Effect;
  species: ClaimSpecies;
  speciesBucket: 'human' | 'observational' | 'animal';
  grades: Grade[]; // all claim grades, for the grade-chip filter
  claimOutcomes: string[]; // for text filtering
  hasCaution: boolean;
  lastMove: string | null; // "D → C · 2026-03"
  lastMoveDate: string; // for sorting; '' when none
  claimCount: number;
  studyCount: number;
}

export function registerRows(compounds: Compound[]): RegisterRow[] {
  return compounds.map((c) => {
    const best = c.data.claims[0]!;
    const mv = c.data.history[0];
    const lastMoveDate = c.data.history.length
      ? c.data.history.map((h) => h.date).sort().at(-1)!
      : '';
    return {
      id: c.id,
      name: c.data.name,
      synonyms: c.data.synonyms,
      cats: c.data.cats,
      claimCats: [...new Set(c.data.claims.map((cl) => cl.cat))],
      outcome: best.outcome,
      grade: best.grade,
      effect: best.effect,
      species: best.species,
      speciesBucket: speciesBucket(best.species),
      grades: [...new Set(c.data.claims.map((cl) => cl.grade))],
      claimOutcomes: c.data.claims.map((cl) => cl.outcome),
      hasCaution: !!c.data.caution,
      lastMove: mv ? `${mv.from} → ${mv.to} · ${mv.date}` : null,
      lastMoveDate,
      claimCount: c.data.claims.length,
      studyCount: c.data.claims.reduce((a, cl) => a + cl.studies.length, 0),
    };
  });
}

export function sortRows(rows: RegisterRow[], sort: 'grade' | 'movement' | 'studies'): RegisterRow[] {
  const r = [...rows];
  if (sort === 'grade')
    r.sort((a, b) => gradeRank(a.grade) - gradeRank(b.grade) || b.studyCount - a.studyCount);
  if (sort === 'movement') r.sort((a, b) => b.lastMoveDate.localeCompare(a.lastMoveDate));
  if (sort === 'studies') r.sort((a, b) => b.studyCount - a.studyCount);
  return r;
}

/** Dose guides for the stack checker, keyed by compound id. */
export function doseGuides(compounds: Compound[]): Record<string, DoseGuide> {
  const out: Record<string, DoseGuide> = {};
  for (const c of compounds) {
    const best = c.data.claims[0]!;
    out[c.id] = {
      compoundId: c.id,
      name: c.data.name,
      bestGrade: best.grade,
      bestClaim: best.outcome,
      studiedMinMg: c.data.doseGuide?.studiedMinMg,
      studiedMaxMg: c.data.doseGuide?.studiedMaxMg,
      ulMg: c.data.doseGuide?.ulMg,
    };
  }
  return out;
}

export interface CostSnapshot {
  eurPerGram: number;
  formLabel: string;
  brand: string;
}

/** Cheapest €/g of active for a compound, from the product records. */
export async function costSnapshot(compoundId: string): Promise<CostSnapshot | null> {
  const products = await getCollection('products', (p) => p.data.compoundId === compoundId);
  let best: CostSnapshot | null = null;
  for (const p of products) {
    const factor =
      p.data.form === 'active'
        ? 1
        : FORM_FACTORS.find((f) => f.compoundId === compoundId && f.form === p.data.form)?.factor;
    if (factor === undefined) continue;
    const eur = costPerGramActive({
      priceEur: p.data.priceEur,
      servings: p.data.servings,
      dosePerServingMg: p.data.dosePerServingMg,
      factor,
    });
    if (eur !== null && (best === null || eur < best.eurPerGram)) {
      const formLabel =
        FORM_FACTORS.find((f) => f.compoundId === compoundId && f.form === p.data.form)?.label ??
        p.data.form;
      best = { eurPerGram: eur, formLabel, brand: p.data.brand };
    }
  }
  return best;
}
