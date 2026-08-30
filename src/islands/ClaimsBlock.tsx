import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Grade, Effect } from '../lib/grades';
import type { ClaimSpecies } from '../lib/species';
import type { Flag } from '../lib/flags';
import { GradeBadge, EffectTicks, SpeciesLabel, FlagLine, StudyCard, type StudyData } from '../components/ui';
// Shared with scripts/regrade-draft.mjs, which links to these same anchors from
// the newsletter draft. See the header of claim-slug.js for why it is not .ts.
import { claimSlugs, panelIdFor } from '../lib/claim-slug.js';

export interface ClaimData {
  outcome: string;
  grade: Grade;
  effect: Effect;
  species: ClaimSpecies;
  flags: Flag[];
  studies: StudyData[];
}

/** Current fragment, minus the `#`. Malformed percent-escapes decode to themselves. */
function hashSlug(): string {
  if (typeof window === 'undefined') return '';
  const raw = window.location.hash.slice(1);
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export default function ClaimsBlock({ claims }: { claims: ClaimData[] }) {
  const slugs = useMemo(() => claimSlugs(claims.map((c) => c.outcome)), [claims]);

  // Resolved during the first render, not in an effect: a page loaded with a
  // claim hash should paint with that claim already open rather than flashing
  // collapsed. An unknown hash simply opens nothing.
  //
  // Revisited (mobile/a11y audit): this initialiser opens the panel visually
  // but on its own it reported the wrong state to assistive tech. Preact's
  // hydration reuses the server's DOM and deliberately skips the prop diff
  // (`diffElementNodes`: "During hydration, props are not diffed at all"), so
  // any attribute whose client value differs from the server's stays stale
  // until that value next *changes*. On a `#claim` load that is exactly the
  // permalinked row: the panel is on screen while its button still carries the
  // server's `aria-expanded="false"` and no `aria-controls`. Moving the
  // resolution into an effect would fix the attributes and reintroduce the
  // collapsed flash. Both are kept instead — see the mount sync below.
  const [open, setOpen] = useState<string | null>(() => {
    const s = hashSlug();
    return s && slugs.includes(s) ? s : null;
  });

  // The other half of that decision. The two attributes the server could not
  // know are written once, imperatively, on mount; from then on every toggle
  // goes through the ordinary prop diff, which is now in sync with the DOM
  // (Preact compares vnode props to vnode props, so a one-time correction
  // holds). Only the initially-open row can differ from the server markup, so
  // only that row carries the ref.
  const openButton = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const btn = openButton.current;
    if (!open || !btn) return;
    btn.setAttribute('aria-expanded', 'true');
    btn.setAttribute('aria-controls', panelIdFor(open));
  }, []);

  // Scroll the linked claim into view once, on load. Deliberately instant — the
  // site animates nothing — and `scroll-margin-top` on the row keeps it off the
  // very top edge. A claim far down the page is jumped to directly; the browser
  // has usually already done this natively, since the island is server-rendered
  // and the ids are in the static HTML before hydration.
  useEffect(() => {
    if (!open) return;
    document.getElementById(open)?.scrollIntoView();
  }, []);

  // Back/forward across a permalink click, or a hash typed into the URL bar.
  // `replaceState` never fires this, so toggling cannot loop through here.
  useEffect(() => {
    function onHashChange() {
      const s = hashSlug();
      setOpen(slugs.includes(s) ? s : null);
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [slugs]);

  // `replaceState`, not `pushState`: expanding a row is view state, not
  // navigation. Ten toggles must not cost ten presses of Back to leave the
  // page. The permalink below is a real link, so a left-click gets the browser's
  // ordinary in-page behaviour — but the hash it points at is already current by
  // then, so in practice it re-scrolls rather than adding an entry.
  function toggle(slug: string) {
    const next = open === slug ? null : slug;
    setOpen(next);
    if (typeof window === 'undefined') return;
    const { pathname, search } = window.location;
    window.history.replaceState(null, '', next ? `${pathname}${search}#${next}` : `${pathname}${search}`);
  }

  return (
    <div class="card" style={{ margin: '16px 0 28px' }}>
      {/* `claims-head` is only a hook for the narrow-viewport rule in
          global.css: the rows below wrap into stacked lines long before the
          header does, so under 460px it would label columns that no longer
          exist — and it is the widest thing in the card. The register's header
          keeps its own behaviour; it shares `table-head` but lives inside an
          `overflow-x` container. */}
      <div class="table-head claims-head">
        <div style={{ flex: '0 0 40px' }}>GRADE</div>
        <div style={{ flex: '1 1 220px' }}>CLAIM</div>
        <div style={{ flex: '0 0 96px' }}>SPECIES</div>
        <div style={{ flex: '0 0 120px' }}>EFFECT</div>
        <div style={{ flex: '0 0 60px', textAlign: 'right' }}>STUDIES</div>
      </div>
      {claims.map((c, i) => {
        const slug = slugs[i]!;
        const panelId = panelIdFor(slug);
        const expanded = open === slug;
        return (
          <div key={slug} id={slug} style={{ borderBottom: '1px solid var(--line-soft)', scrollMarginTop: '16px' }}>
            <button
              ref={expanded ? openButton : undefined}
              onClick={() => toggle(slug)}
              aria-expanded={expanded}
              aria-controls={expanded ? panelId : undefined}
              style={{
                display: 'flex',
                gap: '16px',
                alignItems: 'center',
                width: '100%',
                textAlign: 'left',
                background: expanded ? 'var(--paper-hover)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '13px 20px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ flex: '0 0 40px' }}>
                <GradeBadge grade={c.grade} size={40} />
              </div>
              <div style={{ flex: '1 1 220px', minWidth: '180px' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>{c.outcome}</div>
                <div style={{ marginTop: '3px' }}>
                  <FlagLine flags={c.flags} />
                </div>
              </div>
              <div style={{ flex: '0 0 96px' }}>
                <SpeciesLabel species={c.species} />
              </div>
              <div style={{ flex: '0 0 120px' }}>
                <EffectTicks effect={c.effect} />
              </div>
              <div
                style={{
                  flex: '0 0 60px',
                  textAlign: 'right',
                  fontFamily: 'var(--mono)',
                  fontSize: '13px',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {/* `--muted`, not `--muted-2`: the expanded chevron sits on
                    `--paper-hover` and measured 4.25:1 there. */}
                {c.studies.length} <span style={{ color: 'var(--muted)' }}>{expanded ? '▴' : '▾'}</span>
              </div>
            </button>
            {expanded && (
              <div
                id={panelId}
                style={{ padding: '4px 20px 18px', background: 'var(--expand-bg)', borderTop: '1px solid var(--line-mid)' }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '16px',
                    flexWrap: 'wrap',
                    padding: '12px 0 10px',
                  }}
                >
                  <div class="micro-label" style={{ fontSize: '10px' }}>
                    STUDIES BEHIND THIS GRADE — STRONGEST FIRST
                  </div>
                  {/* A plain link, not a copy button: right-click and copy works
                      without the clipboard API, which is unavailable over plain
                      http. It sits inside the open panel rather than on every
                      row, so it adds one tab stop while a claim is open instead
                      of one per claim. It cannot live on the claim heading —
                      that heading is inside the <button>, and an <a> nested in a
                      <button> is invalid, non-navigable markup. */}
                  <a
                    href={`#${slug}`}
                    class="micro-label"
                    style={{ fontSize: '10px', color: 'var(--amber)', marginLeft: 'auto' }}
                  >
                    LINK TO THIS CLAIM
                  </a>
                </div>
                {/* `min(300px, 100%)`, not a bare 300px: the panel is only
                    ~230px wide at a 320px viewport, and a 300px track floor
                    made the cards overflow their own box and clip their text
                    mid-word ("design meta-analysi"). */}
                {c.studies.length > 0 ? (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))',
                      gap: '12px',
                    }}
                  >
                    {c.studies.map((s) => (
                      <StudyCard study={s} />
                    ))}
                  </div>
                ) : (
                  <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--muted)', padding: '4px 0' }}>
                    Study records for this claim are still being added.
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
