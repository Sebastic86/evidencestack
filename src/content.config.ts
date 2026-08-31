import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const grade = z.enum(['A', 'B', 'C', 'D', 'E']);
const effect = z.enum(['large', 'moderate', 'small', 'negligible', 'unclear']);
// 'human-trial' — interventional but not randomised. See src/lib/species.ts.
const claimSpecies = z.enum(['human-rct', 'human-trial', 'observational', 'rodent', 'in-vitro']);
const studySpecies = z.enum(['human', 'rodent', 'in-vitro']);
const category = z.enum([
  'muscle', 'cognition', 'metabolic', 'cardiovascular', 'sleep', 'joint', 'longevity', 'other',
]);
const flag = z.enum([
  'industry-funded', 'biomarker-only', 'rodent-only', 'dose-mismatch', 'safety-note', 'under-review',
]);

// 'not-declared' means the paper is silent on funding. 'none' means the authors
// state outright that they received none — a different fact, and a meaningful one
// to a reader: an explicitly unfunded independent trial is not the same as an
// undeclared one. Do not collapse them.
const funding = z.enum(['industry', 'public', 'mixed', 'not-declared', 'none']);

/**
 * Per-field verification provenance.
 *
 * Item 1 is tens of hours of work across many sittings, and before this existed
 * the state lived only in prose — so a field verified against a fetched paper
 * was indistinguishable from one nobody had ever opened. That mismatch is how a
 * study funded by the maker of the tested product sat on the site reading
 * `not-declared`.
 *
 * `outcome: unreachable` is a real result worth recording, not a failure: it
 * stops the next pass burning a fetch on a paywall someone already hit. Roughly
 * 40% of full texts are unreachable.
 */
/**
 * What was actually read. `outcome` says what happened to the value; `basis`
 * says how strong the evidence for it is, and the two are not the same thing.
 *
 * Without this, "confirmed" covered four different situations — a funding
 * sentence quoted from the paper, a complete text containing no funding
 * statement at all, a deposited grant record with no statement read, and a
 * trial registry's own funding line. The weakest of those is thin enough to be
 * worth seeing: one record's `public` rests on a single library-side grant
 * linkage while its full text has no funding statement, no acknowledgements and
 * no competing-interests section.
 */
const checkBasis = z.enum([
  'statement', // a funding or competing-interests statement in the paper was read
  'absence', // the complete text was read and contains no funding statement — supports silence, nothing more
  'metadata', // deposited funder metadata (Crossref, Europe PMC grantsList); no statement read
  'registry', // a trial or review registry record's own funding field
]);

const fieldCheck = z
  .object({
    on: z.coerce.date(), // when it was checked
    outcome: z.enum(['confirmed', 'corrected', 'unreachable']),
    basis: checkBasis.optional(), // required unless unreachable — see the refine below
    source: z.string().url().optional(), // what was actually read
    note: z.string().optional(), // e.g. the quoted funding sentence, or why it could not be reached
  })
  .superRefine((c, ctx) => {
    if (c.outcome === 'unreachable') {
      // Nothing was read, so there is nothing to cite or characterise.
      if (c.source || c.basis) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [c.source ? 'source' : 'basis'],
          message: 'an "unreachable" check reached no source, so it must not name one',
        });
      }
      return;
    }
    // You may not claim to have confirmed or corrected a field without naming
    // what you read. Verification you cannot point at is not verification.
    if (!c.source) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['source'],
        message: `a check with outcome "${c.outcome}" must cite the source it was verified against; only "unreachable" may omit it`,
      });
    }
    // …and saying what kind of evidence it was is half the point. A quoted
    // funding sentence and a bare deposited grant linkage are both "confirmed",
    // and the difference between them is exactly what this block exists to
    // record. Caught by a negative control: without this, `basis` could be
    // omitted silently and the build stayed green.
    if (!c.basis) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['basis'],
        message: `a check with outcome "${c.outcome}" must say what it rests on (statement, absence, metadata or registry); only "unreachable" may omit it`,
      });
    }
  });

const study = z.object({
  cite: z.string(), // "First-author et al." — displayed with year
  year: z.number().int(),
  url: z.string().url().optional(), // DOI link or primary source
  species: studySpecies,
  design: z.string(), // "RCT, double-blind", "meta-analysis", "cohort", …
  n: z.number().int().positive(),
  duration: z.string(),
  dose: z.string(),
  funding,
  registry: z.string().optional(),
  outcome: z.string(), // what was measured
  note: z.string(), // reviewer's note: what this study contributes to this claim
  // Which of this record's fields have been checked against the primary source,
  // and when. Absent means never checked. Add keys as further passes happen.
  //
  // `registry` matters as much as `funding`: this repo has carried an invented
  // registry ID, and two real IDs belonging to entirely different studies. It
  // also distinguishes "no registration, verified absent in a full text I read"
  // from "nobody has looked" — which the data could not express before.
  checked: z
    .object({
      funding: fieldCheck.optional(),
      registry: fieldCheck.optional(),
    })
    .optional(),
})
  .superRefine((s, ctx) => {
    // Reading a paper and finding no funding statement establishes that the
    // paper is silent. It cannot establish who paid for the study. So a check
    // resting on absence may only support a funding value that asserts silence.
    const basis = s.checked?.funding?.basis;
    if (basis === 'absence' && s.funding !== 'not-declared') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['funding'],
        message: `funding is "${s.funding}" but its check rests on the absence of any funding statement, which can only support "not-declared" — cite a statement, deposited metadata or a registry record instead`,
      });
    }
  });

const claim = z.object({
  outcome: z.string(), // "muscle mass & strength"
  cat: category,
  grade,
  effect,
  species: claimSpecies, // species of the best evidence for this claim
  flags: z.array(flag).default([]),
  studies: z.array(study).default([]), // ordered strongest first
});

const compounds = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/compounds' }),
  schema: z.object({
    name: z.string(),
    synonyms: z.array(z.string()).default([]),
    forms: z.string(), // display line: "monohydrate · HCl · buffered"
    cats: z.array(category).min(1),
    blurb: z.string(), // two sentences, plain language
    typicalDose: z.string(),
    studiedDose: z.string(),
    ul: z.string(), // "none established" is a valid value
    caution: z.string().optional(),
    hype: z.boolean().default(false), // drives the home "hype vs evidence" list
    reviewed: z.coerce.date(),
    reviewer: z.string(),
    // Machine-readable doses (mg/day of active) for the stack checker.
    doseGuide: z
      .object({
        studiedMinMg: z.number().positive().optional(),
        studiedMaxMg: z.number().positive().optional(),
        ulMg: z.number().positive().optional(),
      })
      .optional(),
    claims: z.array(claim).min(1), // ordered best-supported first
    history: z
      .array(
        z
          .object({
            date: z.string().regex(/^\d{4}-\d{2}$/), // "2026-03"
            claim: z.string(),
            // What kind of editorial event this was. 'move' — the grade changed.
            // 'reaffirmed' — the claim was re-reviewed against new evidence and
            // the grade deliberately held; from and to are the same grade.
            // Defaults to 'move', so every entry written before this field
            // existed stays valid untouched.
            kind: z.enum(['move', 'reaffirmed']).default('move'),
            from: grade,
            to: grade,
            why: z.string(),
          })
          // The two kinds must be told apart by `kind`, never by a reader
          // noticing that two letters happen to match. So the pairing is
          // enforced in both directions: an unmarked no-op regrade — the
          // "B → B" that used to render as a meaningless movement — now fails
          // the build instead of shipping.
          .superRefine((h, ctx) => {
            if (h.kind === 'move' && h.from === h.to)
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['to'],
                message: `history entry "${h.claim}" (${h.date}) is a grade move but from and to are both ${h.from}. A move must change the grade; write kind: reaffirmed for a re-review that held it.`,
              });
            if (h.kind === 'reaffirmed' && h.from !== h.to)
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['to'],
                message: `history entry "${h.claim}" (${h.date}) is marked reaffirmed but the grade moved ${h.from} → ${h.to}. A reaffirmation must keep the same grade; drop the kind field for a real move.`,
              });
          }),
      )
      .default([]), // newest first
  })
    // A history entry names the claim whose grade moved, and the per-claim
    // anchor the timeline, the home page and the newsletter script link to is
    // slugged from the *claim's* `outcome`. So a `history[].claim` that matches
    // no outcome on this compound is not a typo with cosmetic consequences —
    // it is a link to an anchor that does not exist. Nothing downstream may
    // guess: prefix or fuzzy matching would silently resolve to a plausible
    // wrong claim, and the reader lands at the top of the page none the wiser.
    // The only place this can be caught loudly is the build.
    .superRefine((c, ctx) => {
      const outcomes = c.claims.map((cl) => cl.outcome);
      c.history.forEach((h, i) => {
        if (outcomes.includes(h.claim)) return;
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['history', i, 'claim'],
          message: `history entry (${h.date}) names claim "${h.claim}", which is not an outcome on this compound. history[].claim must match a claim's outcome exactly — the per-claim anchor is slugged from it. Valid outcomes: ${outcomes
            .map((o) => `"${o}"`)
            .join(', ')}.`,
        });
      });
    }),
});

const products = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/products' }),
  schema: z.object({
    brand: z.string(),
    name: z.string(),
    compoundId: z.string(),
    form: z.string(), // key into FORM_FACTORS, or 'active' when the label is already elemental
    dosePerServingMg: z.number().positive(),
    servings: z.number().int().positive(),
    priceEur: z.number().positive(),
    thirdPartyTested: z.boolean().default(false),
  }),
});

export const collections = { compounds, products };
