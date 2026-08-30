import type { APIRoute, GetStaticPaths } from 'astro';
import { allCompounds } from '../../../lib/data';

export const getStaticPaths: GetStaticPaths = async () => {
  const compounds = await allCompounds();
  return compounds.map((c) => ({ params: { id: c.id }, props: { compound: c } }));
};

export const GET: APIRoute = async ({ props, site }) => {
  const { compound } = props;
  const d = compound.data;
  const body = {
    source: 'Evidence Stack',
    id: compound.id,
    url: new URL(`/compounds/${compound.id}/`, site).href,
    name: d.name,
    synonyms: d.synonyms,
    forms: d.forms,
    categories: d.cats,
    blurb: d.blurb,
    dosing: {
      typical: d.typicalDose,
      studied: d.studiedDose,
      upperLimit: d.ul,
      caution: d.caution ?? null,
      guide: d.doseGuide ?? null,
    },
    reviewed: d.reviewed.toISOString().slice(0, 10),
    reviewer: d.reviewer,
    claims: d.claims,
    gradeHistory: d.history,
  };
  return new Response(JSON.stringify(body, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
