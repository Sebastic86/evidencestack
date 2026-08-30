export type Flag =
  | 'industry-funded'
  | 'biomarker-only'
  | 'rodent-only'
  | 'dose-mismatch'
  | 'safety-note'
  | 'under-review';

export const FLAG_LABELS: Record<Flag, string> = {
  'industry-funded': 'industry funded',
  'biomarker-only': 'biomarker only',
  'rodent-only': 'rodent only',
  'dose-mismatch': 'dose mismatch',
  'safety-note': 'safety note',
  'under-review': 'under review',
};

export const FLAG_DEFINITIONS: Record<Flag, string> = {
  'industry-funded': 'The study was paid for by a party selling the compound.',
  'biomarker-only': 'Measured a proxy, not an outcome anyone feels.',
  'rodent-only': 'The evidence for this claim comes from rodents.',
  'dose-mismatch': 'The studied dose is far from what supplements actually contain.',
  'safety-note': 'Documented upper limit, contraindication, or interaction class.',
  'under-review': "New evidence has arrived and the grade hasn't been reassessed yet.",
};

export function flagText(flags: Flag[]): string {
  return flags.map((f) => FLAG_LABELS[f]).join(' · ');
}
