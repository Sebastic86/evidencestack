#!/usr/bin/env node
/**
 * regrade-draft — turn recorded grade moves into a newsletter draft.
 *
 * The footer promises "One email when a grade moves." This is the mechanism
 * behind that sentence. It diffs the `history` arrays of the compound records
 * between two git revisions and writes a plain-text draft to stdout.
 *
 * IT SENDS NOTHING. There is no network call anywhere in this file, no API
 * token, and no Buttondown client. It reads git, writes text, and stops. A
 * human reads the draft, edits it, and pastes it into Buttondown. That is
 * deliberate: an email is irreversible and the register's whole claim on the
 * reader is that a person signed off on the words.
 *
 *   node scripts/regrade-draft.mjs                 # HEAD~1..HEAD
 *   node scripts/regrade-draft.mjs v1.2..HEAD
 *   node scripts/regrade-draft.mjs --from HEAD~10 --to HEAD --out draft.txt
 *
 * stdout is the draft and nothing else, so it can be redirected or piped.
 * Everything the operator needs to know but must not paste — warnings, counts,
 * "no grades moved" — goes to stderr.
 */

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { basename } from 'node:path';

// The one place the claim anchor rule is defined. `src/islands/ClaimsBlock.tsx`
// renders those anchors from this same function, so a link written here is a
// link that exists on the page. Never reimplement the slug rule locally.
import { claimSlugs } from '../src/lib/claim-slug.js';

const CONTENT_DIR = 'src/content/compounds';

// Matches public/robots.txt and .github/workflows/ci.yml, which also hardcode
// the live domain. Changing the domain means changing all three (see TODO #9).
const DEFAULT_SITE = 'https://evidencestack.sebastienwouters.dev';

const WRAP_COLS = 76;

const USAGE = `regrade-draft — draft the "a grade moved" email from git history.

  node scripts/regrade-draft.mjs [<from>..<to>] [options]

  --from <rev>   revision to compare from   (default HEAD~1)
  --to <rev>     revision to compare to     (default HEAD)
  --out <file>   write the draft here instead of stdout
  --site <url>   base URL for claim links   (default $SITE_URL, else the live site)
  --moves-only   omit the "re-reviewed, grade held" section at the bottom
  -h, --help     this text

Writes a draft to stdout when at least one grade moved, and nothing at all when
none did. It never sends anything and never touches the network.`;

/** Abort with a message on stderr. Reserved for operator error and broken input. */
function fail(msg) {
  process.stderr.write(`regrade-draft: ${msg}\n`);
  process.exit(1);
}

function warn(msg) {
  process.stderr.write(`regrade-draft: warning: ${msg}\n`);
}

function note(msg) {
  process.stderr.write(`regrade-draft: ${msg}\n`);
}

// ---------------------------------------------------------------------------
// git
// ---------------------------------------------------------------------------

/**
 * execFileSync, never a shell string: compound ids and revision names go
 * straight into argv, so quoting and Windows path separators cannot bite.
 */
function git(args, opts = {}) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...opts,
  });
}

function repoRoot() {
  try {
    return git(['rev-parse', '--show-toplevel']).trim();
  } catch {
    return fail('not inside a git repository.');
  }
}

/** Resolve a revision to a commit sha, with a message that names the rev. */
function resolveRev(rev, cwd) {
  try {
    return git(['rev-parse', '--verify', '--quiet', `${rev}^{commit}`], { cwd }).trim();
  } catch {
    return fail(
      `cannot resolve revision "${rev}".\n` +
        `  A repository with a single commit has no HEAD~1; pass --from explicitly.\n` +
        `  A shallow clone (CI checkouts default to depth 1) has no history to diff.`,
    );
  }
}

/** Compound record paths at a revision, repo-relative, forward slashes. */
function listCompoundFiles(rev, cwd) {
  const out = git(['ls-tree', '-r', '--name-only', '-z', rev, '--', CONTENT_DIR], { cwd });
  return out
    .split('\0')
    .filter((p) => p.endsWith('.yaml'))
    .sort();
}

function showFile(rev, path, cwd) {
  return git(['show', `${rev}:${path}`], { cwd });
}

// ---------------------------------------------------------------------------
// content
// ---------------------------------------------------------------------------

// `yaml` is present in node_modules as a transitive dependency of Astro's
// language tooling (devOptional in the lockfile), not as a declared dependency.
// The brief forbids adding one, so it is imported dynamically and the failure is
// made explicit rather than silently falling back to a hand-rolled parser — a
// second YAML implementation reading the content that the build validates with
// zod would be its own source of drift. If this ever throws, the fix is one line
// in package.json: add `yaml` to devDependencies.
let YAML;
try {
  YAML = (await import('yaml')).default;
} catch (err) {
  fail(
    `cannot load the "yaml" package (${err.message}).\n` +
      `  It is currently only present as a transitive dependency of Astro's tooling.\n` +
      `  Add "yaml" to devDependencies in package.json and run npm install.`,
  );
}

/**
 * The compound id Astro's glob loader derives from a file path: the path below
 * src/content/compounds, without the .yaml extension.
 */
function compoundIdFor(path) {
  return path.slice(CONTENT_DIR.length + 1).replace(/\.yaml$/, '');
}

/**
 * Read every compound record at a revision.
 *
 * Only the four fields this script needs are pulled out. The zod schema in
 * src/content.config.ts is the real validator and runs at build time; this
 * reads defensively instead of re-implementing it, because it is deliberately
 * pointed at old revisions whose records may predate the current schema.
 */
function readCompounds(rev, cwd) {
  const map = new Map();
  for (const path of listCompoundFiles(rev, cwd)) {
    let doc;
    try {
      doc = YAML.parse(showFile(rev, path, cwd));
    } catch (err) {
      fail(`cannot parse ${path} at ${rev}: ${err.message}`);
    }
    if (!doc || typeof doc !== 'object') {
      warn(`${path} at ${rev} is empty or not a mapping; skipped.`);
      continue;
    }
    const id = compoundIdFor(path);
    const claims = Array.isArray(doc.claims) ? doc.claims : [];
    map.set(id, {
      id,
      path,
      name: typeof doc.name === 'string' && doc.name ? doc.name : id,
      outcomes: claims.map((c) => (c && typeof c.outcome === 'string' ? c.outcome : '')),
      history: (Array.isArray(doc.history) ? doc.history : [])
        .filter((h) => h && typeof h === 'object')
        .map((h) => ({
          date: String(h.date ?? ''),
          claim: String(h.claim ?? ''),
          // `kind` was added to the schema after the first records were written
          // and defaults to 'move' there, so an entry without it is a move.
          kind: h.kind === 'reaffirmed' ? 'reaffirmed' : 'move',
          kindWasExplicit: h.kind !== undefined,
          from: String(h.from ?? ''),
          to: String(h.to ?? ''),
          why: typeof h.why === 'string' ? h.why : '',
        })),
    });
  }
  return map;
}

// ---------------------------------------------------------------------------
// diffing history
// ---------------------------------------------------------------------------

/**
 * Identity of a history entry, for deciding whether it is new.
 *
 * `why` is deliberately NOT part of the key. Rewording the explanation of a
 * move that already went out must not re-announce it. Changing the grades, the
 * date, the claim or the kind does change the key, so such an edit shows up as
 * one entry withdrawn and one new — the operator gets both warnings and decides
 * whether that is a correction worth mailing.
 */
function entryKey(h) {
  return [h.date, h.claim, h.kind, h.from, h.to].join('\0');
}

/**
 * History entries present at `to` that were not present at `from`, as a
 * multiset difference so that two genuinely identical entries both count.
 */
function newEntries(fromHistory, toHistory) {
  const remaining = new Map();
  for (const h of fromHistory) {
    const k = entryKey(h);
    remaining.set(k, (remaining.get(k) ?? 0) + 1);
  }
  const added = [];
  for (const h of toHistory) {
    const k = entryKey(h);
    const n = remaining.get(k) ?? 0;
    if (n > 0) remaining.set(k, n - 1);
    else added.push(h);
  }
  return added;
}

/** Entries at `from` with no counterpart at `to` — withdrawn or rewritten. */
function droppedEntries(fromHistory, toHistory) {
  return newEntries(toHistory, fromHistory);
}

/**
 * Split new entries into what may be mailed and what may not.
 *
 * This is the function the whole script exists to get right. A reaffirmation is
 * a re-review that deliberately held the grade. It is real editorial work, it
 * belongs on the compound timeline, and it is NOT movement — the promise in the
 * footer is specifically "one email when a grade moves". So it can never be a
 * regrade here, can never appear in the subject line, and can never be the
 * reason a draft exists at all.
 *
 * The third bucket is the one that used to slip through: an entry marked (or
 * defaulted to) `move` whose from and to are the same grade. The current schema
 * rejects that at build time, but this script reads old revisions where it was
 * still valid — omega-3's 2025-12 entry is exactly that, before it was marked
 * reaffirmed. It is not a move and it is not a signed reaffirmation either, so
 * it is reported to the operator and mailed as neither.
 */
function classify(entries) {
  const moves = [];
  const reaffirmations = [];
  const rejected = [];
  for (const h of entries) {
    if (h.kind === 'reaffirmed') {
      if (h.from !== h.to) {
        // Cannot happen under the current schema, which refuses it in both
        // directions. Refuse to guess which field is wrong.
        rejected.push({ h, why: `marked reaffirmed but the grade moved ${h.from} → ${h.to}` });
      } else {
        reaffirmations.push(h);
      }
    } else if (h.from === h.to) {
      rejected.push({
        h,
        why: h.kindWasExplicit
          ? `marked kind: move but from and to are both ${h.from}`
          : `has from and to both ${h.from} and no kind field, so it is neither a move nor a signed reaffirmation`,
      });
    } else {
      moves.push(h);
    }
  }
  return { moves, reaffirmations, rejected };
}

// ---------------------------------------------------------------------------
// links
// ---------------------------------------------------------------------------

/**
 * URL of the claim a history entry refers to.
 *
 * `history[].claim` is a free-text string that is supposed to equal a claim's
 * `outcome`. When it does not, no link is written: a wrong anchor is worse than
 * none, because the page silently loads at the top and the reader never learns
 * the link was broken. Slugs are computed from the claims array at the `to`
 * revision, since that is the page the reader will land on, and since a slug
 * depends on the whole array through the collision rule.
 */
function claimUrl(site, compound, claimText) {
  const slugs = claimSlugs(compound.outcomes);
  let i = compound.outcomes.indexOf(claimText);
  if (i === -1) {
    const norm = (s) => s.trim().toLowerCase();
    i = compound.outcomes.findIndex((o) => norm(o) === norm(claimText));
  }
  if (i === -1) return null;
  return `${site}/compounds/${compound.id}/#${slugs[i]}`;
}

// ---------------------------------------------------------------------------
// drafting
// ---------------------------------------------------------------------------

/** Greedy wrap for the `why` text. Folded YAML scalars arrive as one long line. */
function wrap(text, cols = WRAP_COLS) {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    if (!line) line = w;
    else if (line.length + 1 + w.length <= cols) line += ` ${w}`;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function subjectFor(moves) {
  if (moves.length === 1) {
    const m = moves[0];
    return `${m.compoundName} — ${m.claim}: ${m.from} → ${m.to}`;
  }
  const names = [...new Set(moves.map((m) => m.compoundName))];
  const shown = names.slice(0, 3).join(', ');
  const rest = names.length - 3;
  return `${moves.length} grades moved: ${shown}${rest > 0 ? `, and ${rest} more` : ''}`;
}

/**
 * The draft body.
 *
 * Voice: plain and dry, the register's own register. A downgrade is written
 * with exactly the template an upgrade gets — same heading, same arrow, same
 * `why` verbatim from the record, no softening and no apology. The arrow says
 * the direction; the one-line note about what A and E mean is at the bottom, so
 * it reads the same whichever way a grade went.
 */
function draft(moves, reaffirmations, site) {
  const out = [];
  out.push(`Subject: ${subjectFor(moves)}`);
  out.push('');
  out.push(
    moves.length === 1
      ? 'One claim grade moved in the register.'
      : `${moves.length} claim grades moved in the register.`,
  );
  out.push('');

  for (const m of moves) {
    out.push('');
    const isNew = m.compoundIsNew ? ' (new in the register)' : '';
    out.push(`${m.compoundName.toUpperCase()}${isNew} — ${m.claim}`);
    out.push(`${m.from} → ${m.to}  ·  ${m.date}`);
    out.push('');
    for (const line of wrap(m.why)) out.push(line);
    if (m.url) {
      out.push('');
      out.push(m.url);
    } else {
      out.push('');
      out.push(`${site}/compounds/${m.compoundId}/`);
    }
    out.push('');
  }

  if (reaffirmations.length > 0) {
    out.push('');
    out.push('--');
    out.push('');
    out.push('Also re-reviewed, grade held:');
    out.push('');
    for (const r of reaffirmations) {
      out.push(`${r.compoundName} — ${r.claim}: ${r.from} held  ·  ${r.date}`);
      for (const line of wrap(r.why)) out.push(line);
      if (r.url) out.push(r.url);
      out.push('');
    }
  }

  out.push('--');
  out.push('');
  out.push(
    ...wrap(
      'Grades run A (multiple human RCTs, consistent, independently replicated) ' +
        'to E (tested in humans and found not to work). A grade is a statement ' +
        'about the state of the evidence, not a recommendation.',
    ),
  );
  out.push('');
  out.push(`${site}/methodology/`);
  out.push('');
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = { from: 'HEAD~1', to: 'HEAD', out: null, site: null, movesOnly: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) fail(`${a} needs a value.`);
      return v;
    };
    if (a === '-h' || a === '--help') {
      process.stdout.write(`${USAGE}\n`);
      process.exit(0);
    } else if (a === '--from') opts.from = next();
    else if (a === '--to') opts.to = next();
    else if (a === '--out') opts.out = next();
    else if (a === '--site') opts.site = next();
    else if (a === '--moves-only') opts.movesOnly = true;
    else if (a.includes('..')) {
      const [from, to] = a.split('..');
      if (!from || !to) fail(`"${a}" is not a <from>..<to> range.`);
      opts.from = from;
      opts.to = to;
    } else fail(`unknown argument "${a}". Run with --help.`);
  }
  return opts;
}

const opts = parseArgs(process.argv.slice(2));
const cwd = repoRoot();
const site = (opts.site ?? process.env.SITE_URL ?? DEFAULT_SITE).replace(/\/+$/, '');

const fromSha = resolveRev(opts.from, cwd);
const toSha = resolveRev(opts.to, cwd);
if (fromSha === toSha) {
  note(`${opts.from} and ${opts.to} are the same commit; nothing to compare.`);
  process.exit(0);
}

const before = readCompounds(fromSha, cwd);
const after = readCompounds(toSha, cwd);

const moves = [];
const reaffirmations = [];

for (const [id, compound] of after) {
  const old = before.get(id);
  const compoundIsNew = old === undefined;
  const added = newEntries(old?.history ?? [], compound.history);
  const dropped = droppedEntries(old?.history ?? [], compound.history);

  for (const h of dropped) {
    warn(
      `${id}: history entry "${h.claim}" (${h.date}, ${h.from} → ${h.to}) is present at ` +
        `${opts.from} but not at ${opts.to}. It was withdrawn or rewritten; check whether the ` +
        `replacement below is a correction you want to mail.`,
    );
  }

  const { moves: m, reaffirmations: r, rejected } = classify(added);

  for (const { h, why } of rejected) {
    warn(
      `${id}: history entry "${h.claim}" (${h.date}) ${why}. ` +
        `It is in NEITHER the moves nor the re-reviewed section. Fix the record.`,
    );
  }

  const decorate = (h) => {
    const url = claimUrl(site, compound, h.claim);
    if (!url)
      warn(
        `${id}: history entry names claim "${h.claim}", which is not the outcome of any claim ` +
          `on the compound at ${opts.to}. Linking to the compound page instead of an anchor.`,
      );
    return {
      ...h,
      compoundId: id,
      compoundName: compound.name,
      compoundIsNew,
      url,
    };
  };

  moves.push(...m.map(decorate));
  reaffirmations.push(...r.map(decorate));

  if (compoundIsNew && compound.history.length === 0)
    note(`${id} is new in the register and has no history entries, so it is not in the draft.`);
}

for (const id of before.keys()) {
  if (!after.has(id))
    warn(
      `${id} exists at ${opts.from} but not at ${opts.to}. If the file was renamed rather than ` +
        `deleted, the new id's entire history counts as new and will be re-announced — check the ` +
        `draft before sending.`,
    );
}

// Newest first, matching the register and the compound timelines.
const byDate = (a, b) => b.date.localeCompare(a.date) || a.compoundName.localeCompare(b.compoundName);
moves.sort(byDate);
reaffirmations.sort(byDate);

if (moves.length === 0) {
  // The one thing this must never do is produce an empty email. No moves, no
  // draft, nothing on stdout, exit 0.
  note(
    `no grades moved between ${opts.from} and ${opts.to}. No draft written.` +
      (reaffirmations.length > 0
        ? ` (${reaffirmations.length} re-review${reaffirmations.length === 1 ? '' : 's'} held the ` +
          `grade; a reaffirmation is not a regrade and does not send an email.)`
        : ''),
  );
  process.exit(0);
}

const body = draft(moves, opts.movesOnly ? [] : reaffirmations, site);

if (opts.out) {
  writeFileSync(opts.out, body, 'utf8');
  note(`wrote ${basename(opts.out)} — ${moves.length} grade move(s). Read it before sending.`);
} else {
  process.stdout.write(body);
}
note('nothing was sent. Paste the draft into Buttondown by hand.');
