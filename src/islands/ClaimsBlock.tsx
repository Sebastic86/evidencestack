import { useState } from 'preact/hooks';
import type { Grade, Effect } from '../lib/grades';
import type { ClaimSpecies } from '../lib/species';
import type { Flag } from '../lib/flags';
import { GradeBadge, EffectTicks, SpeciesLabel, FlagLine, StudyCard, type StudyData } from '../components/ui';

export interface ClaimData {
  outcome: string;
  grade: Grade;
  effect: Effect;
  species: ClaimSpecies;
  flags: Flag[];
  studies: StudyData[];
}

export default function ClaimsBlock({ claims }: { claims: ClaimData[] }) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div class="card" style={{ margin: '16px 0 28px' }}>
      <div class="table-head">
        <div style={{ flex: '0 0 40px' }}>GRADE</div>
        <div style={{ flex: '1 1 220px' }}>CLAIM</div>
        <div style={{ flex: '0 0 96px' }}>SPECIES</div>
        <div style={{ flex: '0 0 120px' }}>EFFECT</div>
        <div style={{ flex: '0 0 60px', textAlign: 'right' }}>STUDIES</div>
      </div>
      {claims.map((c, i) => {
        const expanded = open === i;
        return (
          <div style={{ borderBottom: '1px solid var(--line-soft)' }}>
            <button
              onClick={() => setOpen(expanded ? null : i)}
              aria-expanded={expanded}
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
                {c.studies.length} <span style={{ color: 'var(--muted-2)' }}>{expanded ? '▴' : '▾'}</span>
              </div>
            </button>
            {expanded && (
              <div style={{ padding: '4px 20px 18px', background: 'var(--expand-bg)', borderTop: '1px solid var(--line-mid)' }}>
                <div class="micro-label" style={{ padding: '12px 0 10px', fontSize: '10px' }}>
                  STUDIES BEHIND THIS GRADE — STRONGEST FIRST
                </div>
                {c.studies.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px' }}>
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
