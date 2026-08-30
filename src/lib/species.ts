/** Species of evidence behind a claim. Never hidden, never collapsed into the grade. */
export type ClaimSpecies = 'human-rct' | 'observational' | 'rodent' | 'in-vitro';
export type StudySpecies = 'human' | 'rodent' | 'in-vitro';

export const CLAIM_SPECIES_LABEL: Record<ClaimSpecies, string> = {
  'human-rct': 'HUMAN RCT',
  observational: 'HUMAN OBS.',
  rodent: 'RODENT ONLY',
  'in-vitro': 'IN VITRO',
};

export function isNonHuman(sp: ClaimSpecies | StudySpecies): boolean {
  return sp === 'rodent' || sp === 'in-vitro';
}

/** Filter bucket used by the register's "best evidence" filter. */
export function speciesBucket(sp: ClaimSpecies): 'human' | 'observational' | 'animal' {
  if (sp === 'human-rct') return 'human';
  if (sp === 'observational') return 'observational';
  return 'animal';
}
