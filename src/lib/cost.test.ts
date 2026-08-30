import { describe, expect, it } from 'vitest';
import { ACTIVE_FACTOR, costPerGramActive, formatEurPerGram, FORM_FACTORS } from './cost';

/**
 * The site's pitch is that its numbers are checkable, so these tests check the
 * arithmetic against hand-computed values rather than against the code's own output.
 */

describe('costPerGramActive', () => {
  it('divides price by grams of ACTIVE, not grams of product', () => {
    // 100 servings x 500 mg product x 0.60 elemental = 30 000 mg = 30 g active.
    // EUR 10 / 30 g = EUR 0.3333/g. Per gram of *product* it would be EUR 0.20/g.
    const eur = costPerGramActive({ priceEur: 10, servings: 100, dosePerServingMg: 500, factor: 0.6 });
    expect(eur).toBeCloseTo(10 / 30, 10);
    expect(eur).not.toBeCloseTo(0.2, 10);
  });

  it('is a pure passthrough of price/grams when the label is already elemental', () => {
    // 60 x 500 mg = 30 g. factor 1 => EUR 24 / 30 g = EUR 0.80/g.
    expect(
      costPerGramActive({ priceEur: 24, servings: 60, dosePerServingMg: 500, factor: ACTIVE_FACTOR.factor }),
    ).toBeCloseTo(0.8, 10);
  });

  it('scales inversely with the form factor: half the elemental fraction, twice the price per gram', () => {
    const base = { priceEur: 12, servings: 90, dosePerServingMg: 400 };
    const strong = costPerGramActive({ ...base, factor: 0.6 })!;
    const weak = costPerGramActive({ ...base, factor: 0.3 })!;
    expect(weak).toBeCloseTo(strong * 2, 10);
  });

  it('magnesium oxide vs citrate: the elemental fraction decides, at equal label dose and price', () => {
    const bottle = { priceEur: 9.99, servings: 100, dosePerServingMg: 400 };
    const oxide = costPerGramActive({ ...bottle, factor: 0.6 })!; // 0.6 => 24 g active
    const citrate = costPerGramActive({ ...bottle, factor: 0.16 })!; // 0.16 => 6.4 g active
    expect(oxide).toBeCloseTo(9.99 / 24, 10);
    expect(citrate).toBeCloseTo(9.99 / 6.4, 10);
    expect(citrate).toBeGreaterThan(oxide);
    expect(citrate / oxide).toBeCloseTo(0.6 / 0.16, 10);
  });

  it('makes the calculator worked example come out the way the page claims: the cheaper bottle loses', () => {
    // Mirrors DEMO in src/islands/CostCalculator.tsx. Invented prices, real form factors.
    const citrate = costPerGramActive({ priceEur: 5.99, servings: 60, dosePerServingMg: 375, factor: 0.16 })!;
    const oxide = costPerGramActive({ priceEur: 12.99, servings: 120, dosePerServingMg: 500, factor: 0.6 })!;
    expect(citrate).toBeCloseTo(5.99 / 3.6, 10); // 60 x 375 x 0.16 = 3.6 g active
    expect(oxide).toBeCloseTo(12.99 / 36, 10); // 120 x 500 x 0.60 = 36 g active
    expect(5.99).toBeLessThan(12.99); // cheaper bottle...
    expect(citrate).toBeGreaterThan(oxide); // ...more expensive per gram of elemental magnesium
  });

  it.each([
    ['zero price', { priceEur: 0, servings: 60, dosePerServingMg: 500, factor: 1 }],
    ['negative price', { priceEur: -10, servings: 60, dosePerServingMg: 500, factor: 1 }],
    ['zero servings', { priceEur: 10, servings: 0, dosePerServingMg: 500, factor: 1 }],
    ['negative servings', { priceEur: 10, servings: -60, dosePerServingMg: 500, factor: 1 }],
    ['zero dose', { priceEur: 10, servings: 60, dosePerServingMg: 0, factor: 1 }],
    ['negative dose', { priceEur: 10, servings: 60, dosePerServingMg: -500, factor: 1 }],
    ['zero factor', { priceEur: 10, servings: 60, dosePerServingMg: 500, factor: 0 }],
    ['negative factor', { priceEur: 10, servings: 60, dosePerServingMg: 500, factor: -1 }],
    ['NaN price (empty input field)', { priceEur: NaN, servings: 60, dosePerServingMg: 500, factor: 1 }],
    ['NaN servings', { priceEur: 10, servings: NaN, dosePerServingMg: 500, factor: 1 }],
    ['NaN dose', { priceEur: 10, servings: 60, dosePerServingMg: NaN, factor: 1 }],
    ['NaN factor', { priceEur: 10, servings: 60, dosePerServingMg: 500, factor: NaN }],
  ])('returns null rather than a number for %s', (_label, input) => {
    expect(costPerGramActive(input)).toBeNull();
  });

  it('never returns a negative or NaN price per gram for any input it accepts', () => {
    const inputs = [
      { priceEur: 0.01, servings: 1, dosePerServingMg: 0.001, factor: 0.072 },
      { priceEur: 999, servings: 365, dosePerServingMg: 5000, factor: 1 },
    ];
    for (const i of inputs) {
      const v = costPerGramActive(i)!;
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThan(0);
    }
  });
});

describe('FORM_FACTORS', () => {
  it('pins the elemental fractions users are asked to trust', () => {
    const byKey = Object.fromEntries(FORM_FACTORS.map((f) => [`${f.compoundId}:${f.form}`, f.factor]));
    expect(byKey['magnesium:oxide']).toBe(0.6);
    expect(byKey['magnesium:citrate']).toBe(0.16);
    expect(byKey['magnesium:glycinate']).toBe(0.14);
    expect(byKey['magnesium:threonate']).toBe(0.072);
    expect(byKey['creatine:monohydrate']).toBe(0.879);
    expect(byKey['omega-3:epa-dha']).toBe(1);
    expect(byKey['omega-3:fish-oil-30']).toBe(0.3);
    expect(byKey['berberine:hcl']).toBe(0.9);
  });

  it('orders the magnesium salts the way chemistry does — oxide richest, threonate poorest', () => {
    const mg = FORM_FACTORS.filter((f) => f.compoundId === 'magnesium');
    const sorted = [...mg].sort((a, b) => b.factor - a.factor).map((f) => f.form);
    expect(sorted).toEqual(['oxide', 'citrate', 'malate', 'glycinate', 'taurate', 'threonate']);
  });

  it('holds every factor in (0, 1] — a salt cannot be more than 100% elemental', () => {
    for (const f of FORM_FACTORS) {
      expect(f.factor, `${f.compoundId}:${f.form}`).toBeGreaterThan(0);
      expect(f.factor, `${f.compoundId}:${f.form}`).toBeLessThanOrEqual(1);
    }
  });

  it('has no duplicate compoundId:form key, so the lookups in data.ts/CostCalculator are unambiguous', () => {
    const keys = FORM_FACTORS.map((f) => `${f.compoundId}:${f.form}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('gives every entry a non-empty human label', () => {
    for (const f of FORM_FACTORS) expect(f.label.trim().length).toBeGreaterThan(0);
  });

  it("reserves the 'active' form key for ACTIVE_FACTOR, which must be a no-op", () => {
    expect(ACTIVE_FACTOR.factor).toBe(1);
    expect(FORM_FACTORS.some((f) => f.form === 'active')).toBe(false);
  });
});

describe('formatEurPerGram', () => {
  it('renders two decimals with the euro sign and unit', () => {
    expect(formatEurPerGram(0.3333333)).toBe('€0.33/g');
    expect(formatEurPerGram(1.664)).toBe('€1.66/g');
    expect(formatEurPerGram(1.666)).toBe('€1.67/g');
    expect(formatEurPerGram(12)).toBe('€12.00/g');
  });

  it('does not round a real cost down to €0.00/g', () => {
    // Sub-cent costs per gram exist (bulk creatine); they should read as 0.00 only if truly ~0.
    expect(formatEurPerGram(0.004)).toBe('€0.00/g');
    expect(formatEurPerGram(0.006)).toBe('€0.01/g');
  });
});
