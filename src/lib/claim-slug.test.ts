import { describe, expect, it } from 'vitest';
import { claimSlugs, panelIdFor, slugify } from './claim-slug.js';

/**
 * The per-claim URL hash rule.
 *
 * This is pinned harder than a private helper would be, because two callers now
 * depend on it agreeing exactly: `src/islands/ClaimsBlock.tsx` renders the
 * anchors, and `scripts/regrade-draft.mjs` writes links to them into a
 * newsletter draft that a human pastes into Buttondown. A change here that only
 * one caller knew about would ship emails pointing at anchors that do not
 * exist, and nothing would fail loudly.
 */

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Cognition in healthy adults')).toBe('cognition-in-healthy-adults');
  });

  it('collapses runs of punctuation and spaces into one hyphen', () => {
    expect(slugify('muscle mass  &  strength')).toBe('muscle-mass-strength');
    expect(slugify('depression, as adjunct treatment')).toBe('depression-as-adjunct-treatment');
  });

  it('strips leading and trailing hyphens', () => {
    expect(slugify('  — sleep quality —  ')).toBe('sleep-quality');
  });

  it('strips accents rather than dropping the letter', () => {
    // NFKD then combining-mark removal: the base letter survives, so an accented
    // outcome does not silently lose a syllable from its hash.
    expect(slugify('Alzheimér disease')).toBe('alzheimer-disease');
    // NFKD also expands compatibility forms, so a subscript digit survives as a
    // digit rather than being stripped as punctuation.
    expect(slugify('VO₂ max')).toBe('vo2-max');
  });

  it('returns an empty string when nothing survives', () => {
    expect(slugify('—')).toBe('');
    expect(slugify('日本語')).toBe('');
  });
});

describe('claimSlugs', () => {
  it('slugs each outcome and preserves order', () => {
    expect(
      claimSlugs(['triglyceride lowering', 'cardiovascular events', 'depression, as adjunct treatment']),
    ).toEqual(['triglyceride-lowering', 'cardiovascular-events', 'depression-as-adjunct-treatment']);
  });

  it('derives the slug from the outcome, not the index', () => {
    // Claims are ordered best-supported first and editorial work reorders them.
    // The same outcome must keep the same hash in either order, or every link
    // ever shared breaks on a re-sort.
    const a = claimSlugs(['muscle mass', 'bone density']);
    const b = claimSlugs(['bone density', 'muscle mass']);
    expect(a).toEqual(['muscle-mass', 'bone-density']);
    expect(b).toEqual(['bone-density', 'muscle-mass']);
  });

  it('falls back to "claim" when an outcome slugs to nothing', () => {
    expect(claimSlugs(['日本語'])).toEqual(['claim']);
  });

  it('gives two identical outcomes distinct slugs, first one bare', () => {
    expect(claimSlugs(['sleep quality', 'sleep quality', 'sleep quality'])).toEqual([
      'sleep-quality',
      'sleep-quality-2',
      'sleep-quality-3',
    ]);
  });

  it('treats outcomes differing only in punctuation as a collision', () => {
    expect(claimSlugs(['sleep quality', 'Sleep  quality!'])).toEqual([
      'sleep-quality',
      'sleep-quality-2',
    ]);
  });

  it('does not let a suffixed duplicate steal a literal outcome slug', () => {
    // The while-loop case: "x-2" is a real outcome here, so the duplicate of "x"
    // must skip past it to "x-3" rather than colliding with a claim that
    // legitimately owns "x-2".
    expect(claimSlugs(['x', 'x 2', 'x'])).toEqual(['x', 'x-2', 'x-3']);
  });

  it('reserves each row panel id, so an outcome cannot collide with a panel', () => {
    // Claim "x" owns the panel id "x-studies". An outcome that slugs to
    // "x studies" must not take the same id, or `aria-controls` on one row would
    // point at the other row's panel.
    expect(claimSlugs(['x', 'x studies'])).toEqual(['x', 'x-studies-2']);
  });

  it('reserves the panel id in the other order too', () => {
    // Symmetric: claim "x studies" takes the slug "x-studies", which is exactly
    // the panel id claim "x" would need, so "x" yields to "x-2". Either row
    // could have been the one to move; the rule is only that they cannot share.
    expect(claimSlugs(['x studies', 'x'])).toEqual(['x-studies', 'x-2']);
    expect(panelIdFor('x-2')).toBe('x-2-studies');
  });

  it('never emits a duplicate slug or panel id for a large claim set', () => {
    const outcomes = ['a', 'a', 'a studies', 'a', 'a 2', '', '—', 'A!', 'a-studies'];
    const slugs = claimSlugs(outcomes);
    const ids = [...slugs, ...slugs.map(panelIdFor)];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('returns nothing for no claims', () => {
    expect(claimSlugs([])).toEqual([]);
  });
});

describe('panelIdFor', () => {
  it('suffixes the slug', () => {
    expect(panelIdFor('cognition')).toBe('cognition-studies');
  });
});
