export type Grade = 'A' | 'B' | 'C' | 'D' | 'E';
export type Effect = 'large' | 'moderate' | 'small' | 'negligible' | 'unclear';

export const GRADES: Record<Grade, string> = {
  A: 'Multiple human RCTs, consistent direction, independently replicated, hard endpoints.',
  B: 'At least one well-conducted human RCT, or consistent human observational data with a plausible mechanism.',
  C: 'Human data only, but small, short, mixed, or limited to surrogate biomarkers.',
  D: 'Animal or in-vitro only. No human evidence for this claim.',
  E: 'Tested in humans and found not to work, or contradicted by the better studies.',
};

export const GRADE_ORDER: Grade[] = ['A', 'B', 'C', 'D', 'E'];

export function gradeRank(g: Grade): number {
  return GRADE_ORDER.indexOf(g);
}

/** Badge colors per grade — must not imply "A = buy this"; A is knowledge, not endorsement. */
export const GRADE_STYLE: Record<Grade, { bg: string; color: string }> = {
  A: { bg: 'var(--green)', color: 'white' },
  B: { bg: 'var(--green-lt)', color: 'var(--ink)' },
  C: { bg: 'var(--paper)', color: 'var(--ink)' },
  D: { bg: 'var(--grade-d-bg)', color: 'var(--ink)' },
  E: { bg: 'var(--grade-e-bg)', color: 'white' },
};

const EFFECT_TICKS: Record<Effect, number> = {
  large: 4,
  moderate: 3,
  small: 2,
  negligible: 0,
  unclear: 0,
};

export function effectTicks(effect: Effect): boolean[] {
  const n = EFFECT_TICKS[effect];
  return [0, 1, 2, 3].map((i) => i < n);
}
