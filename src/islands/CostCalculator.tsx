import { useState } from 'preact/hooks';
import { FORM_FACTORS, ACTIVE_FACTOR, costPerGramActive, formatEurPerGram } from '../lib/cost';

interface Entry {
  name: string;
  priceEur: string;
  servings: string;
  doseMg: string;
  formKey: string; // "compoundId:form" or "active"
}

/**
 * Empty state demonstrates the point instead of asking for input: the cheaper
 * bottle loses on cost per gram of elemental magnesium.
 */
const DEMO: Entry[] = [
  { name: 'DailyBasics Magnesium Citrate 375 mg', priceEur: '5.99', servings: '60', doseMg: '375', formKey: 'magnesium:citrate' },
  { name: 'PowderWorks Magnesium Oxide 500 mg', priceEur: '12.99', servings: '120', doseMg: '500', formKey: 'magnesium:oxide' },
];

const EMPTY: Entry = { name: '', priceEur: '', servings: '', doseMg: '', formKey: 'active' };

function factorFor(key: string): { factor: number; label: string } {
  if (key === 'active') return { factor: 1, label: ACTIVE_FACTOR.label };
  const [compoundId, form] = key.split(':');
  const f = FORM_FACTORS.find((x) => x.compoundId === compoundId && x.form === form);
  return f ? { factor: f.factor, label: f.label } : { factor: 1, label: key };
}

const inputStyle = {
  padding: '8px 10px',
  fontSize: '13px',
  border: '1px solid var(--line-input)',
  background: 'var(--paper)',
  width: '100%',
  boxSizing: 'border-box' as const,
};

export default function CostCalculator() {
  const [entries, setEntries] = useState<Entry[]>(DEMO);

  const update = (i: number, patch: Partial<Entry>) =>
    setEntries(entries.map((e, j) => (j === i ? { ...e, ...patch } : e)));

  const results = entries.map((e) => {
    const { factor, label } = factorFor(e.formKey);
    const eur = costPerGramActive({
      priceEur: parseFloat(e.priceEur),
      servings: parseFloat(e.servings),
      dosePerServingMg: parseFloat(e.doseMg),
      factor,
    });
    const activePerServing = parseFloat(e.doseMg) > 0 ? parseFloat(e.doseMg) * factor : null;
    return { entry: e, eur, factor, label, activePerServing };
  });
  const valid = results.filter((r) => r.eur !== null) as ((typeof results)[0] & { eur: number })[];
  const cheapest = valid.length ? Math.min(...valid.map((r) => r.eur)) : null;
  const cheapestBottle = valid.length ? Math.min(...valid.map((r) => parseFloat(r.entry.priceEur))) : null;
  const bottleWinnerLoses =
    valid.length >= 2 &&
    cheapest !== null &&
    valid.find((r) => parseFloat(r.entry.priceEur) === cheapestBottle)!.eur !== cheapest;

  return (
    <div>
      {results.map((r, i) => (
        <div class="card" style={{ marginBottom: '14px', padding: '14px 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px 14px' }}>
            <label style={{ gridColumn: '1 / -1' }}>
              <span class="micro-label" style={{ fontSize: '10px', display: 'block', marginBottom: '4px' }}>PRODUCT NAME</span>
              <input style={inputStyle} value={r.entry.name} placeholder="Brand + product" onInput={(e) => update(i, { name: (e.target as HTMLInputElement).value })} />
            </label>
            <label>
              <span class="micro-label" style={{ fontSize: '10px', display: 'block', marginBottom: '4px' }}>PRICE (€)</span>
              <input style={inputStyle} type="number" min="0" step="0.01" value={r.entry.priceEur} onInput={(e) => update(i, { priceEur: (e.target as HTMLInputElement).value })} />
            </label>
            <label>
              <span class="micro-label" style={{ fontSize: '10px', display: 'block', marginBottom: '4px' }}>SERVINGS</span>
              <input style={inputStyle} type="number" min="0" value={r.entry.servings} onInput={(e) => update(i, { servings: (e.target as HTMLInputElement).value })} />
            </label>
            <label>
              <span class="micro-label" style={{ fontSize: '10px', display: 'block', marginBottom: '4px' }}>DOSE / SERVING (MG)</span>
              <input style={inputStyle} type="number" min="0" value={r.entry.doseMg} onInput={(e) => update(i, { doseMg: (e.target as HTMLInputElement).value })} />
            </label>
            <label>
              <span class="micro-label" style={{ fontSize: '10px', display: 'block', marginBottom: '4px' }}>COMPOUND FORM</span>
              <select style={inputStyle} value={r.entry.formKey} onChange={(e) => update(i, { formKey: (e.target as HTMLSelectElement).value })}>
                <option value="active">{ACTIVE_FACTOR.label}</option>
                {FORM_FACTORS.map((f) => (
                  <option value={`${f.compoundId}:${f.form}`}>{f.label}</option>
                ))}
              </select>
            </label>
          </div>
          <div
            style={{
              marginTop: '12px',
              paddingTop: '10px',
              borderTop: '1px dashed oklch(0.88 0.012 160)',
              display: 'flex',
              gap: '18px',
              flexWrap: 'wrap',
              alignItems: 'baseline',
            }}
          >
            {r.eur !== null ? (
              <>
                <span style={{ fontSize: '18px', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: r.eur === cheapest && valid.length > 1 ? 'var(--green-text)' : 'var(--ink)' }}>
                  {formatEurPerGram(r.eur)}
                </span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--muted)' }}>
                  of active · {Math.round(r.factor * 100)}% of labeled dose ({r.label.toLowerCase()}) · {r.activePerServing !== null ? `${Math.round(r.activePerServing)} mg active/serving` : ''}
                </span>
                {r.eur === cheapest && valid.length > 1 && (
                  <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', fontWeight: 700, color: 'var(--green-text)' }}>← BEST VALUE</span>
                )}
              </>
            ) : (
              <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--muted)' }}>fill in price, servings and dose to calculate</span>
            )}
            {entries.length > 1 && (
              <button
                onClick={() => setEntries(entries.filter((_, j) => j !== i))}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--muted)' }}
              >
                REMOVE ✕
              </button>
            )}
          </div>
        </div>
      ))}

      <button
        onClick={() => setEntries([...entries, { ...EMPTY }])}
        class="card"
        style={{ padding: '10px 16px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '20px' }}
      >
        + ADD A PRODUCT TO COMPARE
      </button>

      {bottleWinnerLoses && (
        <div class="card" style={{ borderLeft: '3px solid var(--green)', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', lineHeight: 1.5 }}>
          The cheapest <i>bottle</i> here is not the cheapest per gram of <i>active compound</i> —
          once you count only the elemental/active fraction, the price order flips. That's the
          whole point of this tool.
        </div>
      )}
    </div>
  );
}
