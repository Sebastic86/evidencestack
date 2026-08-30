import type { APIRoute } from 'astro';
import { allCompounds, registerRows, sortRows } from '../../lib/data';

export const GET: APIRoute = async ({ site }) => {
  const compounds = await allCompounds();
  const rows = sortRows(registerRows(compounds), 'grade');
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
      lastRegrade: r.lastMoveDate || null,
      url: new URL(`/compounds/${r.id}/`, site).href,
      json: new URL(`/api/compounds/${r.id}.json`, site).href,
    })),
  };
  return new Response(JSON.stringify(body, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
