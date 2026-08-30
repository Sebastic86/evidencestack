# Evidence Stack

A searchable register of longevity supplements where every compound is graded **per health claim** against the actual studies behind it, plus two tools: cost per gram of active compound, and a stack overlap checker.

Product spec: [`longevity-evidence-db-mvp.md`](./longevity-evidence-db-mvp.md).

## Stack

- [Astro](https://astro.build) (fully static output) + Preact islands for the interactive parts
- Content lives as **schema-validated YAML in git** (`src/content/compounds/*.yaml`) — no database. The zod schema in `src/content.config.ts` is the content CI: `npm run build` fails on any invalid record.
- Public JSON API generated at build: `/api/compounds.json` and `/api/compounds/<id>.json`
- Newsletter: the footer form posts to Buttondown's embed endpoint (username in `src/config.ts`)

## Develop

```sh
npm install
npm run dev        # http://localhost:4321
npm run build      # validates all content + builds to dist/
npm run preview    # serve the built site locally
```

## Authoring content

One YAML file per compound in `src/content/compounds/`. Claims are ordered **best-supported first** (the first claim is the compound's headline everywhere). Studies within a claim are ordered strongest first. Grade changes are appended to `history` (newest first) — they drive the home page's "recently regraded" list and are the newsletter's only content.

> ⚠️ All seed content is marked `reviewer: "draft — unverified"`. Citations, numbers and grades were drafted by an AI assistant and **must be editorially verified against the primary sources before being presented as authoritative**. The product collection (`src/content/products/`) is deliberately empty: it previously held fictional sample records, and the cost snapshot on a compound page is hidden until real label and price data from a real retailer is entered. Add a record and the snapshot reappears on that compound. The cost calculator's preloaded rows are a worked example with invented prices and no brand names.

## Regrade newsletter

The footer promises "one email when a grade moves". `scripts/regrade-draft.mjs` is what makes that promise keepable: it diffs the `history` arrays of the compound records between two git revisions and writes a plain-text draft to stdout.

```sh
npm run regrade-draft                            # HEAD~1..HEAD
npm run regrade-draft -- <tag-of-last-email>..HEAD
npm run regrade-draft -- --from HEAD~20 --to HEAD --out draft.txt
npm run regrade-draft -- --help
```

**It sends nothing and makes no network call.** There is no Buttondown client and no API token; a human reads the draft, edits it, and pastes it in. Wiring it up automatically is a later decision, not a missing feature.

- **Default range `HEAD~1..HEAD`** — "what did the commit I just made change". For a real send, pass the range since the last email went out (tagging each send is the easy way to have that revision to hand).
- **A reaffirmation never sends an email.** A `kind: reaffirmed` history entry is a re-review that deliberately held the grade — real editorial work, but not movement, and the promise is specifically about movement. Reaffirmations appear in a separate "also re-reviewed, grade held" section *below* the moves, never in the subject line, never in the count, and never on their own: if nothing but a reaffirmation landed, no draft is written at all. `--moves-only` drops the section entirely.
- **No moves, no draft.** stdout stays empty and the exit code is 0. It never emits an empty email.
- **Claim links** reuse the anchor rule in `src/lib/claim-slug.js`, the same module the claims block renders anchors from, so a link in a draft is a link that exists on the page. When a `history[].claim` string does not exactly match any claim's `outcome`, no anchor is guessed — the draft links to the compound page and the mismatch is reported on stderr.
- stdout is only the pasteable draft. Warnings — a withdrawn or rewritten history entry, a claim that no longer exists, a deleted or renamed compound file, an entry that is neither a move nor a signed reaffirmation — all go to stderr. **Read them.**
- Link base URL: `--site`, else `SITE_URL`, else the live domain.

## Deploy (Coolify)

Live at **https://evidencestack.sebastienwouters.dev** — Coolify project `evidencestack`, environment `production`, build pack **Dockerfile**, `SITE_URL` set as a build-time env var. Pushing to `main` and redeploying in Coolify ships the change.

To recreate elsewhere:

1. Push this repo to a git remote Coolify can reach.
2. In Coolify: **New resource → Application → your repo**, build pack **Dockerfile**, exposed port **80**.
3. Set the domain, and add `SITE_URL=https://yourdomain.tld` as a build-time env var (canonical URLs + sitemap).

The container is nginx serving static files — a few MB of RAM. For scale, put free Cloudflare in front, or move `dist/` to any static host unchanged.

## Before launch

- [ ] Create the Buttondown account and set `BUTTONDOWN_USERNAME` in `src/config.ts`
- [ ] Pick the domain and set `SITE_URL`
- [ ] Editorial review of every compound record (then set a real `reviewer`)
- [ ] Add real product records (label data and prices from named retailers) to bring back the cost snapshot
