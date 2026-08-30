/**
 * JSON-LD builders for the register and the compound records.
 *
 * These are deliberately narrow. The site's whole position is that it does not
 * overstate its evidence, and structured data is read by machines that cannot
 * see the "draft — unverified" marker sitting next to the grade. So the rule
 * here is: **the markup must never assert more than the page does.**
 *
 * What that ruled out, and why — do not add these back without a reason that
 * survives the same test:
 *
 * - `Article` / `ScholarlyArticle` / `Report`. All of them carry an authored,
 *   edited work as their premise, and `author` is effectively required. Nobody
 *   has signed these records off; every one still reads `reviewer: "draft —
 *   unverified"`. Claiming authorship would be the machine-readable version of
 *   exactly the overclaim this site exists to criticise.
 * - `MedicalWebPage`, `Drug`, `DietarySupplement`, `Substance`, `MedicalEntity`.
 *   These are health-authority vocabularies: they tell a consumer the page is
 *   clinical guidance about a substance. `DISCLAIMER` in `src/config.ts` says
 *   the opposite in as many words — "not medical advice, and a grade is not a
 *   recommendation". This is a register of what has been published, not advice.
 * - `aggregateRating` / `Rating` / `Review` / `reviewRating`. A grade of A–E is
 *   a statement about the *state of the evidence*, not a score of a product.
 *   Emitting it as a rating would put star-shaped product scores for compounds
 *   into search results. The grade is described as a dataset variable instead,
 *   and no grade letter is ever emitted as a rating value.
 * - `publisher`, `author`, `creator`, `sdPublisher`, `Organization`, `logo`,
 *   `ContactPoint`. `CONTACT_EMAIL` is empty on purpose and the operator's
 *   legal name is still an open question (TODO items 4+5). The domain is not a
 *   substitute for either. Known cost: Google wants `publisher` on a `Dataset`
 *   for rich results, so the register may not qualify until that is a real
 *   name. That is the trade, taken knowingly.
 * - `datePublished` / `dateModified`. `reviewed` in the YAML is a review date,
 *   not a modification date, and the two have already diverged in this repo
 *   (records were edited without touching it). A wrong date is worse than none.
 * - `license`. No licence has been chosen. Silence is accurate.
 * - `BreadcrumbList`, `WebSite`, `Organization`. Navigational or identity
 *   markup that does nothing for either goal here.
 */
import { DISCLAIMER, SITE_NAME } from '../config';

/** The one place the register dataset's node identifier is built. */
const REGISTER_PATH = '/compounds/';
const METHODOLOGY_PATH = '/methodology/';
const REGISTER_API_PATH = '/api/compounds.json';

/**
 * Absolute URL against the configured site, degrading to a root-relative
 * reference when `Astro.site` is unset rather than throwing. Relative IRIs are
 * legal in JSON-LD and resolve against the document, so an unconfigured build
 * produces markup that is still correct — it just is not absolute.
 */
function abs(path: string, site: URL | string | undefined): string {
  return site ? new URL(path, site).href : path;
}

/**
 * True while a record still carries the drafting marker. Kept as one predicate
 * so the page, the markup and the tests cannot drift apart on what "unverified"
 * means. Matches the `reviewer: "draft — unverified"` convention from TODO
 * item 1; a record whose reviewer becomes a real name stops being draft.
 */
export function isDraftRecord(reviewer: string): boolean {
  return reviewer.trim().toLowerCase().startsWith('draft');
}

/** Stable `@id` for the register dataset, so `isPartOf` cannot drift from it. */
export function registerDatasetId(site: URL | string | undefined): string {
  return `${abs(REGISTER_PATH, site)}#dataset`;
}

export interface RegisterSummary {
  compoundCount: number;
  claimCount: number;
  /**
   * Sum of the per-claim study lists, so a paper cited under two claims counts
   * twice. The wording says "study entries" rather than "studies" for exactly
   * that reason — this is not a count of distinct papers.
   */
  studyCount: number;
  /** How many of `compoundCount` still read "draft — unverified". */
  draftCount: number;
}

export interface CompoundRecord {
  id: string;
  name: string;
  blurb: string;
  cats: string[];
  reviewer: string;
  claimCount: number;
  /**
   * Sum of the per-claim study lists, so a paper cited under two claims counts
   * twice. The wording says "study entries" rather than "studies" for exactly
   * that reason — this is not a count of distinct papers.
   */
  studyCount: number;
}

/**
 * `Dataset` for the register at /compounds/. This is the strongest honest thing
 * the site can say about itself: it really is a dataset, it really is published
 * as JSON at the distribution URL, and describing the grade as a *variable* of
 * that dataset says what a grade is without asserting a score.
 */
export function registerDataset(summary: RegisterSummary, site: URL | string | undefined) {
  const { compoundCount, claimCount, studyCount, draftCount } = summary;
  const draftSentence =
    draftCount > 0
      ? ` ${draftCount} of ${compoundCount} records are marked "draft — unverified": their citations, doses, sample sizes and funding sources have not yet been checked against the primary sources.`
      : '';
  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    '@id': registerDatasetId(site),
    name: `${SITE_NAME} — supplement evidence register`,
    url: abs(REGISTER_PATH, site),
    description:
      `Evidence grades for ${compoundCount} supplement compounds, assigned per claim rather than per compound: ` +
      `${claimCount} claims, with ${studyCount} study entries listed as the evidence behind them.` +
      `${draftSentence} ${DISCLAIMER}`,
    inLanguage: 'en',
    isAccessibleForFree: true,
    // What the dataset records. The grade is described here, as a variable with
    // a stated meaning — not emitted anywhere as a rating value.
    variableMeasured: [
      {
        '@type': 'PropertyValue',
        name: 'evidence grade',
        description:
          'A to E, assigned per claim against the published rubric. It describes how well studied a claim is, not how well a product works, and it is not a recommendation.',
      },
      {
        '@type': 'PropertyValue',
        name: 'effect size band',
        description:
          'large, moderate, small, negligible or unclear — how big the reported effect is, separately from how well supported it is.',
      },
      {
        '@type': 'PropertyValue',
        name: 'species of best evidence',
        description:
          'human-rct, observational, rodent or in-vitro — what the strongest evidence behind a claim was done in.',
      },
    ],
    distribution: [
      {
        '@type': 'DataDownload',
        name: 'Register index (JSON)',
        contentUrl: abs(REGISTER_API_PATH, site),
        encodingFormat: 'application/json',
      },
    ],
    // How the grades are arrived at, for anyone deciding whether to trust them.
    usageInfo: abs(METHODOLOGY_PATH, site),
  };
}

/**
 * `Dataset` for one compound's page — a subset of the register, published at
 * its own JSON endpoint. `creativeWorkStatus: 'Draft'` is the honest,
 * machine-readable form of the marker the page prints next to the reviewer, and
 * it disappears on its own the day a record is genuinely verified.
 */
export function compoundDataset(record: CompoundRecord, site: URL | string | undefined) {
  const url = abs(`/compounds/${record.id}/`, site);
  const draft = isDraftRecord(record.reviewer);
  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    '@id': `${url}#dataset`,
    name: `${record.name} — evidence record`,
    url,
    description:
      `${record.blurb} ${record.claimCount} claims about ${record.name}, with ` +
      `${record.studyCount} study entries listed as the evidence behind them.` +
      (draft
        ? ' This record is marked "draft — unverified": its fields have not yet been checked against the primary sources.'
        : '') +
      ` ${DISCLAIMER}`,
    inLanguage: 'en',
    isAccessibleForFree: true,
    keywords: record.cats,
    isPartOf: { '@id': registerDatasetId(site) },
    // Only set while the record is a draft. Absence asserts nothing — it does
    // not claim the record is published or endorsed.
    ...(draft ? { creativeWorkStatus: 'Draft' } : {}),
    distribution: [
      {
        '@type': 'DataDownload',
        name: `${record.name} record (JSON)`,
        contentUrl: abs(`/api/compounds/${record.id}.json`, site),
        encodingFormat: 'application/json',
      },
    ],
    usageInfo: abs(METHODOLOGY_PATH, site),
  };
}

/**
 * Serialise for injection into `<script type="application/ld+json">`.
 *
 * Escaping `<` is what stops a compound name or blurb containing `</script>`
 * (or `<!--`) from closing the block early and turning content into markup.
 * `<` is a legal JSON escape, so parsers see the original character.
 * U+2028 and U+2029 are escaped too — legal in JSON, but not in every consumer
 * that hands the block to a JavaScript parser instead.
 */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
