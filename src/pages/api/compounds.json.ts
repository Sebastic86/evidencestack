import type { APIRoute } from 'astro';
import { allCompounds, registerRows, sortRows } from '../../lib/data';

export const GET: APIRoute = async ({ site }) => {
  const compounds = await allCompounds();
  const rows = sortRows(registerRows(compounds), 'grade');
  // `lastMoveDate` dates the newest history entry of any kind, and a reaffirmation
  // held the grade rather than moving it. Reporting one as `lastRegrade` would tell
  // an API consumer a grade changed when it did not, so only moves count here.
  const lastRegrade = new Map(
    compounds.map((c) => [
      c.id,
      c.data.history
        .filter((h) => h.kind === 'move')
        .map((h) => h.date)
        .sort()
        .at(-1) ?? null,
    ]),
  );
  const body = {
    source: 'Evidence Stack',
    generated: new Date().toISOString(),
    note: 'Grades are per claim, never per compound. Full records at /api/compounds/<id>.json',
    compounds: rows.map((r) => ({
      id: r.id,
      name: r.name,
      synonyms: r.synonyms,
      categories: r.cats,
      bestSupportedClaim: {
        outcome: r.outcome,
        grade: r.grade,
        effect: r.effect,
        species: r.species,
      },
      claimCount: r.claimCount,
      studyCount: r.studyCount,
      lastRegrade: lastRegrade.get(r.id) ?? null,
      url: new URL(`/compounds/${r.id}/`, site).href,
      json: new URL(`/api/compounds/${r.id}.json`, site).href,
    })),
  };
  return new Response(JSON.stringify(body, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
