/** Species of evidence behind a claim. Never hidden, never collapsed into the grade. */
// 'human-trial' is interventional but not randomised: participants were dosed,
// controlled and usually blinded, but allocation was by counterbalancing, Latin
// square, alternation or open assignment. It is neither an RCT nor observational,
// and calling it either is a false statement about the evidence — crossover and
// counterbalanced designs are common in nutrition research, so this will recur.
export type ClaimSpecies = 'human-rct' | 'human-trial' | 'observational' | 'rodent' | 'in-vitro';
export type StudySpecies = 'human' | 'rodent' | 'in-vitro';

export const CLAIM_SPECIES_LABEL: Record<ClaimSpecies, string> = {
  'human-rct': 'HUMAN RCT',
  'human-trial': 'HUMAN TRIAL',
  observational: 'HUMAN OBS.',
  rodent: 'RODENT ONLY',
  'in-vitro': 'IN VITRO',
};

export function isNonHuman(sp: ClaimSpecies | StudySpecies): boolean {
  return sp === 'rodent' || sp === 'in-vitro';
}

/** Filter bucket used by the register's "best evidence" filter. */
export function speciesBucket(sp: ClaimSpecies): 'human' | 'observational' | 'animal' {
  // A non-randomised human trial is still human interventional evidence, so it
  // belongs in the human bucket — the badge, not the filter, carries the
  // distinction between randomised and not.
  if (sp === 'human-rct' || sp === 'human-trial') return 'human';
  if (sp === 'observational') return 'observational';
  return 'animal';
}
