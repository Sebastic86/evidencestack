import { describe, it, expect } from 'vitest';
import {
  compoundDataset,
  isDraftRecord,
  registerDataset,
  registerDatasetId,
  serializeJsonLd,
} from './jsonld';

const SITE = 'https://evidencestack.example.com';

const summary = { compoundCount: 20, claimCount: 48, studyCount: 40, draftCount: 20 };

const record = {
  id: 'creatine',
  name: 'Creatine',
  blurb: 'A compound the body makes from three amino acids. Sold as monohydrate.',
  cats: ['muscle', 'cognition'],
  reviewer: 'draft — unverified',
  claimCount: 3,
  studyCount: 7,
};

/**
 * The fields this site must never assert. These are pinned as absences, not
 * documented as intentions, so that adding one is a failing test rather than a
 * quiet regression: see the header comment in `jsonld.ts` for why each is out.
 */
const FORBIDDEN_KEYS = [
  'author',
  'publisher',
  'creator',
  'sdPublisher',
  'aggregateRating',
  'reviewRating',
  'review',
  'rating',
  'datePublished',
  'dateModified',
  'dateCreated',
  'license',
  'contactPoint',
  'logo',
];

function keysDeep(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) for (const v of value) keysDeep(v, out);
  else if (value && typeof value === 'object')
    for (const [k, v] of Object.entries(value)) {
      out.push(k);
      keysDeep(v, out);
    }
  return out;
}

function typesDeep(value: unknown): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') {
      const t = (v as Record<string, unknown>)['@type'];
      if (typeof t === 'string') out.push(t);
      Object.values(v).forEach(walk);
    }
  };
  walk(value);
  return out;
}

describe('isDraftRecord', () => {
  it('matches the register convention', () => {
    expect(isDraftRecord('draft — unverified')).toBe(true);
    expect(isDraftRecord('  Draft — unverified ')).toBe(true);
  });

  it('stops being draft once a real reviewer name lands', () => {
    expect(isDraftRecord('S. Wouters')).toBe(false);
    expect(isDraftRecord('')).toBe(false);
  });
});

describe('registerDataset', () => {
  const ld = registerDataset(summary, SITE);

  it('is a Dataset with a stable @id compound pages can reference', () => {
    expect(ld['@type']).toBe('Dataset');
    expect(ld['@id']).toBe(`${SITE}/compounds/#dataset`);
    expect(registerDatasetId(SITE)).toBe(ld['@id']);
  });

  it('points its distribution at the real JSON API, absolute', () => {
    expect(ld.distribution).toEqual([
      {
        '@type': 'DataDownload',
        name: 'Register index (JSON)',
        contentUrl: `${SITE}/api/compounds.json`,
        encodingFormat: 'application/json',
      },
    ]);
  });

  it('states the draft count and carries the disclaimer', () => {
    expect(ld.description).toContain('20 of 20 records are marked "draft — unverified"');
    expect(ld.description).toContain('not medical advice');
  });

  it('drops the draft sentence once nothing is unverified', () => {
    const verified = registerDataset({ ...summary, draftCount: 0 }, SITE);
    expect(verified.description).not.toContain('draft');
    expect(verified.description).toContain('not medical advice');
  });

  it('describes the grade as a variable, never as a rating', () => {
    const names = ld.variableMeasured.map((v) => v.name);
    expect(names).toContain('evidence grade');
    expect(ld.variableMeasured.every((v) => v['@type'] === 'PropertyValue')).toBe(true);
    expect(typesDeep(ld)).not.toContain('Rating');
    expect(typesDeep(ld)).not.toContain('AggregateRating');
  });

  it('asserts no publisher, author, rating or date anywhere', () => {
    const keys = keysDeep(ld);
    for (const k of FORBIDDEN_KEYS) expect(keys).not.toContain(k);
  });

  it('degrades to relative references when the site is unconfigured', () => {
    const bare = registerDataset(summary, undefined);
    expect(bare['@id']).toBe('/compounds/#dataset');
    expect(bare.url).toBe('/compounds/');
  });
});

describe('compoundDataset', () => {
  const ld = compoundDataset(record, SITE);

  it('is a Dataset that belongs to the register, not an Article', () => {
    expect(ld['@type']).toBe('Dataset');
    expect(ld.isPartOf).toEqual({ '@id': registerDatasetId(SITE) });
    const types = typesDeep(ld);
    for (const banned of [
      'Article',
      'ScholarlyArticle',
      'MedicalWebPage',
      'Drug',
      'DietarySupplement',
      'Substance',
      'MedicalEntity',
      'Product',
      'Review',
    ])
      expect(types).not.toContain(banned);
  });

  it('points at the per-compound JSON endpoint', () => {
    expect(ld.distribution[0]!.contentUrl).toBe(`${SITE}/api/compounds/creatine.json`);
  });

  it('carries the draft marker through as creativeWorkStatus', () => {
    expect(ld.creativeWorkStatus).toBe('Draft');
    expect(ld.description).toContain('draft — unverified');
  });

  it('omits creativeWorkStatus entirely once a record is verified, asserting nothing', () => {
    const verified = compoundDataset({ ...record, reviewer: 'S. Wouters' }, SITE);
    expect('creativeWorkStatus' in verified).toBe(false);
    expect(verified.description).not.toContain('draft');
  });

  it('never emits a grade letter as a rating value', () => {
    const keys = keysDeep(ld);
    for (const k of FORBIDDEN_KEYS) expect(keys).not.toContain(k);
    expect(keys).not.toContain('ratingValue');
    expect(keys).not.toContain('bestRating');
  });

  it('degrades to relative references when the site is unconfigured', () => {
    const bare = compoundDataset(record, undefined);
    expect(bare['@id']).toBe('/compounds/creatine/#dataset');
    expect(bare.isPartOf).toEqual({ '@id': '/compounds/#dataset' });
  });
});

describe('serializeJsonLd', () => {
  it('round-trips through JSON.parse unchanged', () => {
    const ld = compoundDataset(record, SITE);
    expect(JSON.parse(serializeJsonLd(ld))).toEqual(ld);
  });

  it('cannot break out of the script block', () => {
    // Content is authored in YAML, so a name or blurb carrying markup is a
    // realistic accident rather than an attack. It must not close the block.
    const hostile = compoundDataset(
      {
        ...record,
        name: 'Creatine </script><img src=x onerror=alert(1)>',
        blurb: 'Ends a comment <!-- and opens <script>.',
      },
      SITE,
    );
    const out = serializeJsonLd(hostile);
    expect(out).not.toContain('<');
    expect(out).not.toContain('</script');
    // Escaping is transparent: the parser still sees the original characters.
    expect(JSON.parse(out)).toEqual(hostile);
  });

  it('escapes the line separators that some consumers choke on', () => {
    // Written as code points rather than literal characters: they are
    // invisible in an editor and would not survive a copy-paste.
    const LS = String.fromCharCode(0x2028);
    const PS = String.fromCharCode(0x2029);
    const value = { a: `x${LS}y${PS}z` };
    const out = serializeJsonLd(value);
    expect(out).not.toContain(LS);
    expect(out).not.toContain(PS);
    expect(JSON.parse(out)).toEqual(value);
  });

  it('registers as valid JSON for the register too', () => {
    const ld = registerDataset(summary, SITE);
    expect(JSON.parse(serializeJsonLd(ld))).toEqual(ld);
  });
});
