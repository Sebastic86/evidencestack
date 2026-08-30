/**
 * The one place the per-claim URL hash is defined.
 *
 * WHY THIS FILE IS .js AND NOT .ts — do not "tidy" it into TypeScript.
 * Two things need this rule and they run in different worlds: the Preact island
 * `src/islands/ClaimsBlock.tsx`, which renders the anchors, and
 * `scripts/regrade-draft.mjs`, which is a plain `node` script and must link to
 * those same anchors from a newsletter draft. A `.ts` module could only be
 * imported by the script under `--experimental-strip-types`, which is flagged on
 * Node 22.17 and unflagged later — an npm script that breaks on a Node bump.
 * Plain ESM + JSDoc is importable by both with no flags, and `allowJs` +
 * `moduleResolution: "Bundler"` in the tsconfig means the island still gets
 * types. Two divergent copies of this rule would mean emails linking to anchors
 * that do not exist, which is the whole reason it lives here.
 */

/** Lowercase, strip accents, collapse anything else into single hyphens. */
export function slugify(/** @type {string} */ outcome) {
  return outcome
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Id of the panel a row controls. Kept in one place so `claimSlugs` can reserve it. */
export function panelIdFor(/** @type {string} */ slug) {
  return `${slug}-studies`;
}

/**
 * One hash per claim, derived from the outcome text — never from the index.
 * Claims are ordered best-supported first, so editorial work reorders them; an
 * index-based hash would silently start pointing at a different claim.
 *
 * Collision rule: two claims on one compound can slug identically. The first in
 * array order keeps the bare slug, each later one takes the lowest free `-2`,
 * `-3`, … suffix. The while-loop matters for the case where a literal outcome
 * already slugs to `x-2` — the duplicate of `x` then skips to `x-3` instead of
 * stealing it. Each row also reserves its panel's `<slug>-studies` id, so an
 * outcome slugging to `x-studies` cannot duplicate claim `x`'s panel id.
 *
 * Takes the compound's claim outcomes **in file order**, and returns one slug
 * per outcome at the same index. The whole array is required: a slug depends on
 * what else is on the page, so a single outcome cannot be slugged on its own.
 *
 * @param {string[]} outcomes
 * @returns {string[]}
 */
export function claimSlugs(outcomes) {
  /** @type {Set<string>} */
  const used = new Set();
  return outcomes.map((outcome) => {
    const base = slugify(outcome) || 'claim';
    let slug = base;
    let n = 2;
    while (used.has(slug) || used.has(panelIdFor(slug))) slug = `${base}-${n++}`;
    used.add(slug);
    used.add(panelIdFor(slug));
    return slug;
  });
}
