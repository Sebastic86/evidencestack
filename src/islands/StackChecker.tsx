import { useEffect, useMemo, useState } from 'preact/hooks';
import {
  analyzeStack,
  decodeStack,
  encodeStack,
  newEntryId,
  parseStackPaste,
  type CompoundMatcher,
  type DoseGuide,
  type PasteResult,
  type StackEntry,
} from '../lib/stack';
import { GradeBadge } from '../components/ui';

const inputStyle = {
  padding: '8px 10px',
  fontSize: '13px',
  border: '1px solid var(--line-input)',
  background: 'var(--paper)',
  boxSizing: 'border-box' as const,
};

const VERDICT_LABEL = {
  'over-ul': 'OVER THE UPPER LIMIT',
  'under-studied': 'FAR UNDER STUDIED DOSES',
  'in-range': 'WITHIN STUDIED RANGE',
  'no-data': 'NO DOSE DATA IN REGISTER',
} as const;

const PASTE_PLACEHOLDER = ['magnesium 400 mg', 'Creatine 5 g', 'fish oil 1000 mg', 'Multivit Forte 500 mg'].join('\n');

const isParsed = (r: PasteResult): r is Extract<PasteResult, { status: 'parsed' }> => r.status === 'parsed';

function doseLabel(mg: number): string {
  return mg >= 1000 ? `${(mg / 1000).toFixed(1)} g/day` : `${mg} mg/day`;
}

export default function StackChecker({
  guides,
  options,
}: {
  guides: Record<string, DoseGuide>;
  options: { id: string; name: string }[];
}) {
  const [entries, setEntries] = useState<StackEntry[]>(() => {
    if (typeof window === 'undefined') return [];
    const s = new URLSearchParams(window.location.search).get('s');
    return s ? decodeStack(s) : [];
  });
  const [draft, setDraft] = useState({ compoundId: '', name: '', dailyMg: '', monthlyEur: '' });
  const [paste, setPaste] = useState('');
  const [copied, setCopied] = useState(false);

  // The guides carry the register's own names and synonyms, which is what a pasted
  // line has to be matched against.
  const matchers = useMemo<CompoundMatcher[]>(
    () => Object.values(guides).map((g) => ({ compoundId: g.compoundId, name: g.name, synonyms: g.synonyms })),
    [guides],
  );

  // Re-parsed on every keystroke so the reading is on screen before anything is added:
  // nobody should have to add a line to find out what number it became.
  const pasteResults = useMemo(() => parseStackPaste(paste, matchers), [paste, matchers]);
  const pasteReady = pasteResults.filter(isParsed);
  const pasteRefused = pasteResults.length - pasteReady.length;

  // Keep the URL shareable as the stack changes.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (entries.length) url.searchParams.set('s', encodeStack(entries));
    else url.searchParams.delete('s');
    window.history.replaceState(null, '', url);
  }, [entries]);

  const lines = useMemo(() => analyzeStack(entries, guides), [entries, guides]);
  const monthlyTotal = lines.reduce((a, l) => a + l.monthlyEur, 0);

  function addEntry(e: Event) {
    e.preventDefault();
    const dailyMg = parseFloat(draft.dailyMg);
    const compound = options.find((o) => o.id === draft.compoundId);
    const name = draft.name.trim() || compound?.name || '';
    if (!name || !(dailyMg > 0)) return;
    setEntries([
      ...entries,
      {
        id: newEntryId(),
        compoundId: compound?.id ?? null,
        name,
        dailyMg,
        monthlyEur: parseFloat(draft.monthlyEur) > 0 ? parseFloat(draft.monthlyEur) : undefined,
      },
    ]);
    setDraft({ compoundId: '', name: '', dailyMg: '', monthlyEur: '' });
  }

  /**
   * Add every line that parsed. Each gets its own id even when two lines are
   * identical — two products both carrying magnesium is the finding this tool
   * exists to surface, so they stay separate, individually removable sources.
   * Accepted lines leave the box; refused lines stay put with their reasons.
   */
  function addPasted() {
    if (!pasteReady.length) return;
    setEntries([
      ...entries,
      ...pasteReady.map((r) => ({
        id: newEntryId(),
        compoundId: r.compoundId,
        name: r.name,
        dailyMg: r.dailyMg,
      })),
    ]);
    setPaste(
      pasteResults
        .filter((r) => !isParsed(r))
        .map((r) => r.raw)
        .join('\n'),
    );
  }

  // Remove by entry id, not by compound: a doubled-up line offers one ✕ per source.
  function removeEntries(ids: string[]) {
    const drop = new Set(ids);
    setEntries(entries.filter((e) => !drop.has(e.id)));
  }

  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — the URL bar already holds the link */
    }
  }

  return (
    <div>
      <form onSubmit={addEntry} class="card" style={{ padding: '14px 16px', marginBottom: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px 14px' }}>
          <label>
            <span class="micro-label" style={{ fontSize: '10px', display: 'block', marginBottom: '4px' }}>COMPOUND (FROM REGISTER)</span>
            <select
              style={{ ...inputStyle, width: '100%' }}
              value={draft.compoundId}
              onChange={(e) => setDraft({ ...draft, compoundId: (e.target as HTMLSelectElement).value })}
            >
              <option value="">— pick, or type a name →</option>
              {options.map((o) => (
                <option value={o.id}>{o.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span class="micro-label" style={{ fontSize: '10px', display: 'block', marginBottom: '4px' }}>OR PRODUCT / COMPOUND NAME</span>
            <input
              style={{ ...inputStyle, width: '100%' }}
              value={draft.name}
              placeholder="e.g. Multivit Forte"
              onInput={(e) => setDraft({ ...draft, name: (e.target as HTMLInputElement).value })}
            />
          </label>
          <label>
            <span class="micro-label" style={{ fontSize: '10px', display: 'block', marginBottom: '4px' }}>DAILY DOSE (MG ACTIVE)</span>
            <input
              style={{ ...inputStyle, width: '100%' }}
              type="number"
              min="0"
              value={draft.dailyMg}
              onInput={(e) => setDraft({ ...draft, dailyMg: (e.target as HTMLInputElement).value })}
            />
          </label>
          <label>
            <span class="micro-label" style={{ fontSize: '10px', display: 'block', marginBottom: '4px' }}>COST / MONTH (€, OPTIONAL)</span>
            <input
              style={{ ...inputStyle, width: '100%' }}
              type="number"
              min="0"
              step="0.01"
              value={draft.monthlyEur}
              onInput={(e) => setDraft({ ...draft, monthlyEur: (e.target as HTMLInputElement).value })}
            />
          </label>
        </div>
        <button
          type="submit"
          style={{
            marginTop: '12px',
            padding: '9px 16px',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            border: '2px solid var(--green)',
            boxShadow: '4px 4px 0 var(--ink)',
            background: 'var(--green)',
            color: 'white',
          }}
        >
          ADD TO STACK
        </button>
        <span style={{ marginLeft: '14px', fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--muted)' }}>
          use the compound page's dose info to convert a label dose to mg of active
        </span>
      </form>

      <div class="card" style={{ marginBottom: '20px' }}>
        <div class="card-label">Or paste a list</div>
        <div style={{ padding: '14px 16px' }}>
          <label>
            <span class="micro-label" style={{ fontSize: '10px', display: 'block', marginBottom: '4px' }}>
              ONE PER LINE — NAME, THEN THE DAILY DOSE IN MG, G OR MCG
            </span>
            <textarea
              rows={5}
              value={paste}
              placeholder={PASTE_PLACEHOLDER}
              onInput={(e) => setPaste((e.target as HTMLTextAreaElement).value)}
              style={{
                ...inputStyle,
                width: '100%',
                fontFamily: 'var(--mono)',
                fontSize: '12px',
                lineHeight: 1.6,
                resize: 'vertical',
              }}
            />
          </label>

          {pasteResults.length > 0 && (
            <div style={{ marginTop: '10px', border: '1px solid var(--line-mid)' }}>
              <div
                class="micro-label"
                style={{ fontSize: '10px', padding: '6px 10px', borderBottom: '1px solid var(--line-soft)' }}
              >
                {pasteReady.length} READY TO ADD{pasteRefused > 0 && ` · ${pasteRefused} NOT UNDERSTOOD`}
              </div>
              {pasteResults.map((r, i) => (
                <div
                  key={`${i}:${r.raw}`}
                  style={{
                    display: 'flex',
                    gap: '10px',
                    flexWrap: 'wrap',
                    alignItems: 'baseline',
                    padding: '6px 10px',
                    borderTop: i === 0 ? 'none' : '1px solid var(--line-soft)',
                    fontFamily: 'var(--mono)',
                    fontSize: '11px',
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{ flex: '0 0 12px', color: r.status === 'parsed' ? 'var(--green-text)' : 'var(--amber)' }}
                  >
                    {r.status === 'parsed' ? '→' : '✕'}
                  </span>
                  <span style={{ flex: '1 1 180px', color: 'var(--ink)' }}>{r.raw}</span>
                  {r.status === 'parsed' ? (
                    <span
                      style={{
                        flex: '2 1 260px',
                        color: r.compoundId ? 'var(--green-text)' : 'var(--muted)',
                      }}
                    >
                      {r.matchedName ?? 'not in the register — added as typed'} · {doseLabel(r.dailyMg)}
                    </span>
                  ) : (
                    <span style={{ flex: '2 1 260px', color: 'var(--amber)' }}>{r.reason}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={addPasted}
            disabled={pasteReady.length === 0}
            style={{
              marginTop: '12px',
              padding: '9px 16px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: pasteReady.length ? 'pointer' : 'default',
              border: `2px solid ${pasteReady.length ? 'var(--ink)' : 'var(--line-input)'}`,
              boxShadow: pasteReady.length ? '4px 4px 0 var(--card-shadow)' : 'none',
              background: 'var(--paper)',
              color: pasteReady.length ? 'var(--ink)' : 'var(--muted-2)',
            }}
          >
            {pasteReady.length === 1 ? 'ADD 1 LINE' : `ADD ${pasteReady.length} LINES`}
          </button>
          <span style={{ marginLeft: '14px', fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--muted)' }}>
            lines this tool cannot read are left in the box with the reason — nothing is added on a guess
          </span>
        </div>
      </div>

      {entries.length === 0 && (
        <div style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--muted)', marginBottom: '48px' }}>
          Add what you take — products or raw compounds — and the overlaps, totals and costs appear here.
        </div>
      )}

      {lines.length > 0 && (
        <div class="card" style={{ marginBottom: '20px' }}>
          <div class="card-label">Your stack, merged by compound</div>
          {lines.map((l) => (
            <div key={l.groupKey} style={{ padding: '12px 16px', borderBottom: '1px solid var(--line-soft)', display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ flex: '1 1 220px' }}>
                <div style={{ fontSize: '14px', fontWeight: 700 }}>
                  {l.compoundId ? <a href={`/compounds/${l.compoundId}/`} style={{ color: 'var(--ink)' }}>{l.name}</a> : l.name}
                  {l.duplicated && (
                    <span style={{ marginLeft: '8px', fontFamily: 'var(--mono)', fontSize: '10px', fontWeight: 700, color: 'var(--amber)' }}>
                      DOUBLED UP ×{l.sources.length}
                    </span>
                  )}
                </div>
                {l.duplicated && (
                  <div style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--muted)', marginTop: '2px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px' }}>
                    <span>from:</span>
                    {l.sources.map((s, i) => (
                      <span key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        {i > 0 && <span>+</span>}
                        <span>{s.name}</span>
                        <button
                          onClick={() => removeEntries([s.id])}
                          aria-label={`remove ${s.name} from ${l.name}`}
                          title={`remove ${s.name}`}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--muted)' }}
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {l.guide && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', fontSize: '12px', color: 'var(--body)' }}>
                    <GradeBadge grade={l.guide.bestGrade} size={18} />
                    <span>
                      best-supported claim: {l.guide.bestClaim}
                      {l.monthlyEur > 0 && ` — €${l.monthlyEur.toFixed(2)}/month on a grade-${l.guide.bestGrade} compound`}
                    </span>
                  </div>
                )}
              </div>
              <div style={{ flex: '0 0 130px', fontFamily: 'var(--mono)', fontSize: '13px', fontVariantNumeric: 'tabular-nums' }}>
                {l.totalMg >= 1000 ? `${(l.totalMg / 1000).toFixed(1)} g/day` : `${l.totalMg} mg/day`}
                {l.guide?.studiedMinMg !== undefined && (
                  <div style={{ fontSize: '10px', color: 'var(--muted)' }}>
                    studied: {l.guide.studiedMinMg}–{l.guide.studiedMaxMg ?? '?'} mg
                  </div>
                )}
                {l.guide?.ulMg !== undefined && (
                  <div style={{ fontSize: '10px', color: 'var(--muted)' }}>UL: {l.guide.ulMg} mg</div>
                )}
              </div>
              <div
                style={{
                  flex: '0 0 200px',
                  fontFamily: 'var(--mono)',
                  fontSize: '10px',
                  fontWeight: 700,
                  color: l.verdict === 'over-ul' ? 'var(--amber)' : l.verdict === 'under-studied' ? 'var(--amber)' : l.verdict === 'in-range' ? 'var(--green-text)' : 'var(--muted)',
                }}
              >
                {VERDICT_LABEL[l.verdict]}
              </div>
              <button
                onClick={() => removeEntries(l.sources.map((s) => s.id))}
                aria-label={l.duplicated ? `remove all ${l.sources.length} sources of ${l.name}` : `remove ${l.name}`}
                title={l.duplicated ? `remove all ${l.sources.length} sources` : `remove ${l.name}`}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--muted)' }}
              >
                ✕
              </button>
            </div>
          ))}
          <div style={{ padding: '12px 16px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            {monthlyTotal > 0 && (
              <span style={{ fontSize: '14px', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                €{monthlyTotal.toFixed(2)}/month total
              </span>
            )}
            <button
              onClick={share}
              style={{ marginLeft: 'auto', border: '1px solid var(--line-input)', background: 'var(--paper)', cursor: 'pointer', padding: '7px 12px', fontSize: '12px', fontFamily: 'var(--mono)' }}
            >
              {copied ? 'LINK COPIED ✓' : 'COPY SHAREABLE LINK'}
            </button>
          </div>
        </div>
      )}

      {lines.length > 0 && (
        <div style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--muted-2)', marginBottom: '48px' }}>
          This is arithmetic on published doses, not medical advice — doses that suit studies may not suit you.
        </div>
      )}
    </div>
  );
}
