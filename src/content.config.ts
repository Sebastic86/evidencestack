import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const grade = z.enum(['A', 'B', 'C', 'D', 'E']);
const effect = z.enum(['large', 'moderate', 'small', 'negligible', 'unclear']);
const claimSpecies = z.enum(['human-rct', 'observational', 'rodent', 'in-vitro']);
const studySpecies = z.enum(['human', 'rodent', 'in-vitro']);
const category = z.enum([
  'muscle', 'cognition', 'metabolic', 'cardiovascular', 'sleep', 'joint', 'longevity', 'other',
]);
const flag = z.enum([
  'industry-funded', 'biomarker-only', 'rodent-only', 'dose-mismatch', 'safety-note', 'under-review',
]);

const study = z.object({
  cite: z.string(), // "First-author et al." — displayed with year
  year: z.number().int(),
  url: z.string().url().optional(), // DOI link or primary source
  species: studySpecies,
  design: z.string(), // "RCT, double-blind", "meta-analysis", "cohort", …
  n: z.number().int().positive(),
  duration: z.string(),
  dose: z.string(),
  funding: z.enum(['industry', 'public', 'mixed', 'not-declared']),
  registry: z.string().optional(),
  outcome: z.string(), // what was measured
  note: z.string(), // reviewer's note: what this study contributes to this claim
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
        z.object({
          date: z.string().regex(/^\d{4}-\d{2}$/), // "2026-03"
          claim: z.string(),
          from: grade,
          to: grade,
          why: z.string(),
        }),
      )
      .default([]), // newest first
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
