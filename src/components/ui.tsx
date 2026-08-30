/**
 * Visual primitives shared by static pages (server-rendered, no JS shipped)
 * and the interactive islands. Preact + inline styles, matching the prototype.
 */
import type { ComponentChildren } from 'preact';
import { GRADE_STYLE, effectTicks, type Grade, type Effect } from '../lib/grades';
import { CLAIM_SPECIES_LABEL, isNonHuman, type ClaimSpecies, type StudySpecies } from '../lib/species';
import { flagText, type Flag } from '../lib/flags';

export function GradeBadge({ grade, size = 28 }: { grade: Grade; size?: number }) {
  const s = GRADE_STYLE[grade];
  return (
    <span
      class="grade-badge"
      aria-label={`evidence grade ${grade}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        fontSize: `${size / 2}px`,
        background: s.bg,
        color: s.color,
      }}
    >
      {grade}
    </span>
  );
}

export function EffectTicks({ effect }: { effect: Effect }) {
  return (
    <span>
      <span style={{ display: 'flex', gap: '3px', marginBottom: '4px' }} aria-hidden="true">
        {effectTicks(effect).map((filled) => (
          <span
            style={{
              width: '18px',
              height: '6px',
              background: filled ? 'var(--green)' : 'var(--paper)',
              border: '1px solid var(--ink)',
            }}
          />
        ))}
      </span>
      <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--muted)' }}>
        {effect}
      </span>
    </span>
  );
}

export function SpeciesLabel({ species, size = 10 }: { species: ClaimSpecies; size?: number }) {
  return (
    <span
      style={{
        fontFamily: 'var(--mono)',
        fontSize: `${size}px`,
        color: isNonHuman(species) ? 'var(--amber)' : 'var(--ink)',
      }}
    >
      {CLAIM_SPECIES_LABEL[species]}
    </span>
  );
}

export function FlagLine({ flags }: { flags: Flag[] }) {
  if (!flags.length) return null;
  return (
    <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--amber)' }}>
      {flagText(flags)}
    </span>
  );
}

export interface StudyData {
  cite: string;
  year: number;
  url?: string;
  species: StudySpecies;
  design: string;
  n: number;
  duration: string;
  dose: string;
  funding: 'industry' | 'public' | 'mixed' | 'not-declared';
  registry?: string;
  outcome: string;
  note: string;
}

function Attr({ label, children, span }: { label: string; children: ComponentChildren; span?: boolean }) {
  return (
    <span style={span ? { gridColumn: '1 / -1' } : undefined}>
      <span style={{ color: 'var(--muted-2)' }}>{label} </span>
      {children}
    </span>
  );
}

export function StudyCard({ study }: { study: StudyData }) {
  const s = study;
  return (
    <div class="card" style={{ padding: '14px 16px' }}>
      <div style={{ fontSize: '13px', fontWeight: 700, lineHeight: 1.35 }}>
        {s.url ? (
          <a href={s.url} rel="noopener" style={{ color: 'inherit' }}>
            {s.cite}
          </a>
        ) : (
          s.cite
        )}{' '}
        <span style={{ fontWeight: 400, color: 'var(--muted)' }}>({s.year})</span>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '4px 16px',
          margin: '10px 0',
          fontFamily: 'var(--mono)',
          fontSize: '10px',
        }}
      >
        <Attr label="species">
          <span style={{ color: s.species === 'human' ? 'var(--ink)' : 'var(--amber)' }}>
            {s.species}
          </span>
        </Attr>
        <Attr label="design">{s.design}</Attr>
        <Attr label="n">{s.n}</Attr>
        <Attr label="duration">{s.duration}</Attr>
        <Attr label="dose">{s.dose}</Attr>
        <Attr label="funding">
          <span style={{ color: s.funding === 'industry' ? 'var(--amber)' : 'var(--ink)' }}>
            {s.funding}
          </span>
        </Attr>
        {s.registry && (
          <Attr label="registry" span>
            {s.registry}
          </Attr>
        )}
        <Attr label="outcome" span>
          {s.outcome}
        </Attr>
      </div>
      <div
        style={{
          fontSize: '12px',
          lineHeight: 1.5,
          color: 'var(--body)',
          borderTop: '1px dashed oklch(0.88 0.012 160)',
          paddingTop: '8px',
        }}
      >
        {s.note}
      </div>
    </div>
  );
}
