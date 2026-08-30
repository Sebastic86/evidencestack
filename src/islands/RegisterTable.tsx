import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { RegisterRow } from '../lib/data';
import { GRADE_ORDER, GRADE_STYLE, gradeRank, type Grade } from '../lib/grades';
import { GradeBadge, SpeciesLabel } from '../components/ui';

const CATEGORIES = [
  ['muscle', 'Muscle'],
  ['cognition', 'Cognition'],
  ['metabolic', 'Metabolic'],
  ['cardiovascular', 'Cardiovascular'],
  ['sleep', 'Sleep'],
  ['joint', 'Joint'],
  ['longevity', 'Longevity'],
  ['other', 'Other'],
] as const;

const inputStyle = {
  padding: '8px 10px',
  fontSize: '13px',
  border: '1px solid var(--line-input)',
  background: 'var(--paper)',
};

/**
 * A register row plus how its movement cell should be read. `RegisterRow.lastMove`
 * is a display string and cannot say whether the newest history entry was a grade
 * move or a reaffirmation — a re-review that deliberately held the grade — so the
 * page supplies the kind alongside it. `null` when the compound has no history.
 */
export type RegisterRowView = RegisterRow & { lastMoveKind: 'move' | 'reaffirmed' | null };

export default function RegisterTable({ rows, total }: { rows: RegisterRowView[]; total: number }) {
  // `?q=` is read during the first render so the rows arrive already filtered —
  // the home page's search is a GET form posting here, so this is the primary
  // way people reach this page with a term.
  const [query, setQuery] = useState(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('q') ?? '';
  });

  // The server rendered `value=""` because it cannot see the query string, and
  // Preact's hydration deliberately skips the prop diff — for `value` it only
  // re-applies to a <textarea>. So the box sat empty above a correctly filtered
  // one-row register, which reads as broken. Written once on mount; later
  // keystrokes are unaffected, since Preact diffs `value` against the live DOM
  // value rather than the previous props. Same hydration gap, and same fix, as
  // the claim permalinks in ClaimsBlock.
  const queryInput = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    const el = queryInput.current;
    if (el && query && el.value !== query) el.value = query;
  }, []);
  const [fGrade, setFGrade] = useState<Grade | null>(null);
  const [fCat, setFCat] = useState('');
  const [fSpecies, setFSpecies] = useState('');
  const [fSafety, setFSafety] = useState(false);
  const [sort, setSort] = useState<'grade' | 'movement' | 'studies'>('grade');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = rows.filter((r) => {
      if (
        q &&
        !(
          r.name.toLowerCase().includes(q) ||
          r.synonyms.some((s) => s.toLowerCase().includes(q)) ||
          r.claimOutcomes.some((o) => o.toLowerCase().includes(q))
        )
      )
        return false;
      if (fGrade && !r.grades.includes(fGrade)) return false;
      if (fCat && !r.cats.includes(fCat) && !r.claimCats.includes(fCat)) return false;
      if (fSpecies && r.speciesBucket !== fSpecies) return false;
      if (fSafety && !r.hasCaution) return false;
      return true;
    });
    out = [...out];
    if (sort === 'grade')
      out.sort((a, b) => gradeRank(a.grade) - gradeRank(b.grade) || b.studyCount - a.studyCount);
    if (sort === 'movement') out.sort((a, b) => b.lastMoveDate.localeCompare(a.lastMoveDate));
    if (sort === 'studies') out.sort((a, b) => b.studyCount - a.studyCount);
    return out;
  }, [rows, query, fGrade, fCat, fSpecies, fSafety, sort]);

  return (
    <div>
      <div style={{ padding: '32px 0 12px', display: 'flex', alignItems: 'baseline', gap: '14px', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800 }}>Compound register</h1>
        <span style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--muted)' }}>
          {filtered.length} of {total} compounds
        </span>
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', padding: '8px 0 14px' }}>
        <input
          ref={queryInput}
          value={query}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
          placeholder="Filter by name or claim…"
          aria-label="filter compounds"
          style={{ ...inputStyle, flex: '1 1 220px', padding: '9px 12px', fontFamily: 'var(--mono)' }}
        />
        <div style={{ display: 'flex', gap: '4px' }} role="group" aria-label="filter by grade">
          {GRADE_ORDER.map((g) => {
            const active = fGrade === g;
            const s = GRADE_STYLE[g];
            return (
              <button
                onClick={() => setFGrade(active ? null : g)}
                aria-pressed={active}
                style={{
                  width: '32px',
                  height: '32px',
                  cursor: 'pointer',
                  border: '1.5px solid var(--ink)',
                  fontFamily: 'var(--mono)',
                  fontSize: '14px',
                  background: active ? s.bg : 'var(--paper)',
                  color: active ? s.color : 'var(--ink)',
                  outlineOffset: '2px',
                  ...(active ? { boxShadow: '2px 2px 0 var(--ink)' } : {}),
                }}
              >
                {g}
              </button>
            );
          })}
        </div>
        <select value={fCat} onChange={(e) => setFCat((e.target as HTMLSelectElement).value)} style={inputStyle} aria-label="claim category">
          <option value="">All categories</option>
          {CATEGORIES.map(([v, l]) => (
            <option value={v}>{l}</option>
          ))}
        </select>
        <select value={fSpecies} onChange={(e) => setFSpecies((e.target as HTMLSelectElement).value)} style={inputStyle} aria-label="best evidence species">
          <option value="">Best evidence: any</option>
          <option value="human">Human RCT</option>
          <option value="observational">Observational</option>
          <option value="animal">Animal only</option>
        </select>
        <button
          onClick={() => setFSafety(!fSafety)}
          aria-pressed={fSafety}
          style={{
            ...inputStyle,
            padding: '8px 12px',
            fontSize: '12px',
            cursor: 'pointer',
            background: fSafety ? 'var(--ink)' : 'var(--paper)',
            color: fSafety ? 'white' : 'var(--ink)',
            fontFamily: 'var(--mono)',
          }}
        >
          SAFETY NOTE
        </button>
        <select value={sort} onChange={(e) => setSort((e.target as HTMLSelectElement).value as typeof sort)} style={inputStyle} aria-label="sort">
          <option value="grade">Sort: best grade</option>
          <option value="movement">Sort: recent movement</option>
          <option value="studies">Sort: study count</option>
        </select>
      </div>

      <div class="card" style={{ marginBottom: '48px', overflowX: 'auto' }}>
        <div class="table-head" style={{ minWidth: '760px' }}>
          <div style={{ flex: '0 0 160px' }}>COMPOUND</div>
          <div style={{ flex: '1 1 240px' }}>BEST-SUPPORTED CLAIM</div>
          <div style={{ flex: '0 0 110px' }}>BEST EVIDENCE</div>
          <div style={{ flex: '0 0 120px' }}>LAST MOVEMENT</div>
          <div style={{ flex: '0 0 90px', textAlign: 'right' }}>CLAIMS · STUDIES</div>
        </div>
        {filtered.map((r) => (
          <a
            href={`/compounds/${r.id}/`}
            style={{
              display: 'flex',
              gap: '16px',
              alignItems: 'center',
              width: '100%',
              textDecoration: 'none',
              borderBottom: '1px solid var(--line-soft)',
              padding: '13px 20px',
              minWidth: '760px',
              boxSizing: 'border-box',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--paper-hover)')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = '')}
          >
            <div style={{ flex: '0 0 160px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)' }}>{r.name}</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--muted-2)', marginTop: '2px' }}>
                {r.cats.join(' · ')}
              </div>
            </div>
            <div style={{ flex: '1 1 240px', display: 'flex', alignItems: 'center', gap: '10px', minWidth: '200px' }}>
              <GradeBadge grade={r.grade} size={28} />
              <span style={{ fontSize: '13px', color: 'oklch(0.3 0.02 160)' }}>
                {r.outcome} <span style={{ color: 'var(--muted-2)' }}>· {r.effect}</span>
              </span>
            </div>
            <div style={{ flex: '0 0 110px' }}>
              <SpeciesLabel species={r.species} />
            </div>
            {/* Green is for grade movement. A reaffirmation held the grade, so it
                reads "B held · 2025-12" in muted ink rather than as a move. */}
            <div
              style={{
                flex: '0 0 120px',
                fontFamily: 'var(--mono)',
                fontSize: '10px',
                fontWeight: 700,
                color: r.lastMoveKind === 'reaffirmed' ? 'var(--muted)' : 'var(--green-text)',
              }}
            >
              {r.lastMove ?? '—'}
            </div>
            <div
              style={{
                flex: '0 0 90px',
                textAlign: 'right',
                fontFamily: 'var(--mono)',
                fontSize: '12px',
                fontVariantNumeric: 'tabular-nums',
                color: 'var(--body)',
              }}
            >
              {r.claimCount} · {r.studyCount}
            </div>
          </a>
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: '24px 20px', fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--muted)' }}>
            No compounds match these filters.
          </div>
        )}
      </div>
    </div>
  );
}
