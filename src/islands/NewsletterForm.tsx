import { useState } from 'preact/hooks';
import { BUTTONDOWN_USERNAME } from '../config';

export default function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');

  async function subscribe(e: Event) {
    e.preventDefault();
    if (!email.includes('@') || state === 'busy') return;
    setState('busy');
    try {
      const res = await fetch(
        `https://buttondown.com/api/emails/embed-subscribe/${BUTTONDOWN_USERNAME}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ email }),
        },
      );
      setState(res.ok ? 'done' : 'error');
    } catch {
      setState('error');
    }
  }

  return (
    <form onSubmit={subscribe} style={{ display: 'flex', gap: '8px', flex: '1 1 300px' }}>
      <input
        type="email"
        value={email}
        onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
        placeholder="you@example.com"
        aria-label="email address"
        required
        style={{
          flex: 1,
          padding: '9px 12px',
          fontSize: '13px',
          border: '1px solid var(--line-input)',
          background: 'white',
          fontFamily: 'var(--mono)',
          minWidth: 0,
        }}
      />
      <button
        type="submit"
        disabled={state === 'busy' || state === 'done'}
        style={{
          padding: '9px 16px',
          fontSize: '13px',
          fontWeight: 700,
          cursor: state === 'done' ? 'default' : 'pointer',
          border: '2px solid var(--green)',
          boxShadow: '4px 4px 0 var(--ink)',
          background: state === 'done' ? 'var(--ink)' : 'var(--green)',
          color: 'white',
        }}
      >
        {state === 'done' ? 'DONE ✓' : state === 'busy' ? '…' : state === 'error' ? 'RETRY' : 'SUBSCRIBE'}
      </button>
    </form>
  );
}
