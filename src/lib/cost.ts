/**
 * Cost-per-gram-of-active math. The point of the tool: the label price is per
 * bottle of a compound *form*; what you pay for is the elemental/active fraction.
 */

export interface FormFactor {
  compoundId: string;
  form: string;
  label: string;
  /** Fraction of the labeled dose that is elemental/active compound, by weight. */
  factor: number;
}

/**
 * Elemental/active weight fractions per compound form. Approximate, from molar
 * masses; label conventions vary (some brands already state elemental dose —
 * the calculator has an "already elemental/active" option for those).
 */
export const FORM_FACTORS: FormFactor[] = [
  { compoundId: 'magnesium', form: 'oxide', label: 'Magnesium oxide', factor: 0.60 },
  { compoundId: 'magnesium', form: 'citrate', label: 'Magnesium citrate', factor: 0.16 },
  { compoundId: 'magnesium', form: 'glycinate', label: 'Magnesium glycinate (bisglycinate)', factor: 0.14 },
  { compoundId: 'magnesium', form: 'malate', label: 'Magnesium malate', factor: 0.15 },
  { compoundId: 'magnesium', form: 'taurate', label: 'Magnesium taurate', factor: 0.09 },
  { compoundId: 'magnesium', form: 'threonate', label: 'Magnesium L-threonate', factor: 0.072 },
  { compoundId: 'creatine', form: 'monohydrate', label: 'Creatine monohydrate', factor: 0.879 },
  { compoundId: 'creatine', form: 'hcl', label: 'Creatine HCl', factor: 0.782 },
  { compoundId: 'ca-akg', form: 'ca-akg', label: 'Calcium alpha-ketoglutarate', factor: 0.78 },
  { compoundId: 'omega-3', form: 'epa-dha', label: 'EPA+DHA (as labeled)', factor: 1 },
  { compoundId: 'omega-3', form: 'fish-oil-30', label: 'Fish oil, ~30% EPA/DHA', factor: 0.3 },
  { compoundId: 'nr-nmn', form: 'nr-chloride', label: 'Nicotinamide riboside chloride', factor: 0.878 },
  { compoundId: 'glucosamine', form: 'sulfate-2kcl', label: 'Glucosamine sulfate 2KCl', factor: 0.59 },
  { compoundId: 'glucosamine', form: 'hcl', label: 'Glucosamine HCl', factor: 0.83 },
  { compoundId: 'berberine', form: 'hcl', label: 'Berberine HCl', factor: 0.90 },
];

export const ACTIVE_FACTOR: FormFactor = {
  compoundId: '*',
  form: 'active',
  label: 'Already elemental / active',
  factor: 1,
};

export interface CostInput {
  priceEur: number;
  servings: number;
  dosePerServingMg: number;
  factor: number;
}

/** Euros per gram of elemental/active compound; null when inputs are incomplete. */
export function costPerGramActive(input: CostInput): number | null {
  const { priceEur, servings, dosePerServingMg, factor } = input;
  if (!(priceEur > 0) || !(servings > 0) || !(dosePerServingMg > 0) || !(factor > 0)) return null;
  const activeGrams = (servings * dosePerServingMg * factor) / 1000;
  return priceEur / activeGrams;
}

export function formatEurPerGram(v: number): string {
  return `€${v.toFixed(2)}/g`;
}
