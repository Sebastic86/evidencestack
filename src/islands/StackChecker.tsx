import { useEffect, useMemo, useState } from 'preact/hooks';
import { analyzeStack, decodeStack, encodeStack, type DoseGuide, type StackEntry } from '../lib/stack';
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
  const [copied, setCopied] = useState(false);

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
        compoundId: compound?.id ?? null,
        name,
        dailyMg,
        monthlyEur: parseFloat(draft.monthlyEur) > 0 ? parseFloat(draft.monthlyEur) : undefined,
      },
    ]);
    setDraft({ compoundId: '', name: '', dailyMg: '', monthlyEur: '' });
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

      {entries.length === 0 && (
        <div style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--muted)', marginBottom: '48px' }}>
          Add what you take — products or raw compounds — and the overlaps, totals and costs appear here.
        </div>
      )}

      {lines.length > 0 && (
        <div class="card" style={{ marginBottom: '20px' }}>
          <div class="card-label">Your stack, merged by compound</div>
          {lines.map((l) => (
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line-soft)', display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
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
                  <div style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>
                    from: {l.sources.join(' + ')}
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
                onClick={() => setEntries(entries.filter((e) => !(l.compoundId ? e.compoundId === l.compoundId : e.name === l.name)))}
                aria-label={`remove ${l.name}`}
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
