# Evidence Stack — backlog

Working state as of 2026-08-30: the site is **live** at https://evidencestack.sebastienwouters.dev, 20 compounds / 48 claims / 40 studies, all six MVP pages built, deployed from `main` via Coolify. See `README.md` for dev and deploy, `longevity-evidence-db-mvp.md` for the product spec.

**Read this first if you are an agent picking up work:** the P0 section is not ordinary backlog. This is a health-evidence site whose entire value proposition is that its claims are backed by real, checkable studies. It currently ships AI-drafted citations and fabricated product prices to the public internet. Fixing that outranks every feature below it. Do not add features while P0 items are open unless explicitly told to.

---

## P0 — Integrity. The live site currently misleads.

### 1. Editorially verify all 20 compound records
Every record carries `reviewer: "draft — unverified"`. The citations, sample sizes, doses, funding sources, effect sizes and grades were drafted by an AI assistant from memory and **have not been checked against the primary sources**. Some may be subtly wrong; some may not exist.

- Files: `src/content/compounds/*.yaml`
- For each study: confirm the DOI/URL resolves, and that `n`, `duration`, `dose`, `design`, `funding`, `registry` and `outcome` match the paper. Then confirm the claim's `grade` and `effect` follow the rubric in `src/pages/methodology.astro`.
- The spec budgets 2–4 hours of real work per compound. This is the actual project cost — treat it as ~40–80 hours, not a cleanup pass.
- Done when: each verified file's `reviewer` is a real name and `reviewed` is the verification date. Until a record is verified, leave the draft marker in place — it is doing honest work.

### 2. Cost snapshot on compound pages is computed from invented products
`src/content/products/*.yaml` contains three fictional products (brands "DailyBasics", "PowderWorks") with made-up prices. The compound detail page renders these as a factual "**€X/g** cheapest per gram of active" line, live, with no indication it is sample data.

- Either replace with real label data from real retailers, or hide the cost snapshot until real records exist (`src/pages/compounds/[id].astro`, the `.cost-strip` block; `costSnapshot()` in `src/lib/data.ts`).
- The preloaded magnesium example in the cost calculator (`src/islands/CostCalculator.tsx`, `DEMO`) is fine as an illustration but should be labelled as an example.
- Done when: no fabricated number is presented as a fact about a purchasable product.

### 3. Fifteen of 48 claims have no studies attached
These render a "0" study count and an empty expander, so the grade is asserted with nothing behind it — the exact failure mode the site exists to criticise. Worst case: **Vitamin D → "correcting measured deficiency" is graded A with zero studies shown.**

Claims to fill: Astaxanthin (skin/UV, lifespan) · Berberine (LDL) · Collagen (joint pain) · CoQ10 (statin muscle pain) · Glutathione (skin brightening) · Glycine (oxidative stress w/ NAC) · Hyaluronic acid (knee pain) · L-theanine (attention w/ caffeine) · Lion's mane (nerve regeneration) · Quercetin (URI prevention) · Taurine (blood pressure) · TMG (strength/power) · Vitamin D (deficiency correction, fracture prevention).

- Done when: every claim has at least one study, or the claim is removed.

### 4. Methodology promises a contact address that does not exist
`src/pages/methodology.astro` (corrections section) says to "write to the address in the footer" — the footer has no address. Corrections are load-bearing for trust on a health site.

- Add a real contact email to `src/components/Footer.astro` and a short `/about` or imprint page. An EU-operated site generally needs identifiable operator details.
- Done when: the correction route named in the methodology actually exists.

### 5. Privacy policy and newsletter consent (GDPR)
The site collects email addresses through Buttondown (a US processor) with no privacy policy and no consent language. The operator is EU-based.

- Add `/privacy` covering what is collected, the processor, retention, and how to unsubscribe; link it from the footer and next to the signup field.
- Done when: signup states what someone is agreeing to, and the policy is linked from every page.

---

## P1 — Needed before promoting the site anywhere

### 6. Register the Buttondown account `evidencestack` *(user action, not agent)*
`BUTTONDOWN_USERNAME` in `src/config.ts` is set to `evidencestack`, but that newsletter does not exist yet — the signup form will 404 until it is claimed. If a different name is registered, change that one constant and redeploy.

### 7. Content depth is roughly half the spec
Spec calls for 3–6 claims per compound and 4–10 studies per compound: ~60–120 claims and ~80–200 studies. Current totals are **48 claims and 40 studies**. Fifteen of 20 compounds are thin stubs. Depends on item 1 — verify as you add, do not bulk-generate more unverified records.

### 8. Enable auto-deploy on push
No GitHub webhook is configured (`manual_webhook_secret_github` is empty), so every deploy is a manual API/UI trigger. In Coolify, enable the GitHub webhook for application `z000gs4soooc40gw8ks0408c` so pushes to `main` deploy themselves.

### 9. `robots.txt` and a 404 page
Neither exists (there is no `public/` directory at all). Add `public/robots.txt` pointing at `/sitemap-index.xml`, and `src/pages/404.astro` using the standard `Layout` with a route back into the register.

---

## P2 — Engineering hygiene

### 10. There are no tests
`src/lib/cost.ts` (`costPerGramActive`, form factors) and `src/lib/stack.ts` (`analyzeStack`, `encodeStack`/`decodeStack`) contain the arithmetic users will trust. Add Vitest and cover: elemental conversion math, the UL/under-studied verdict boundaries, duplicate merging, and share-URL round-tripping including malformed input.

### 11. There is no CI
Content errors currently surface only at deploy time. Add a GitHub Actions workflow running `npm ci && npm run build && npm run check` (plus tests once they exist) on push and PR — `astro build` is the content schema validator, so this is the editorial safety net too.

### 12. Security headers
`nginx.conf` sets caching but no `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, or a CSP. Cheap to add; the site loads no third-party scripts, so a strict CSP is realistic.

### 13. No social preview image
Regrade events getting shared is an explicit success criterion in the spec, and shares currently render with no image. Add a typographic `og:image` (per-compound would be better: name + grade). No stock photography, per the design constraints.

---

## P3 — Spec features not yet built

### 14. Stack checker cannot accept a pasted list
The spec asks for "add products or raw compounds with doses, **or paste a list**". Only one-at-a-time entry exists (`src/islands/StackChecker.tsx`). Add a textarea that parses lines like `magnesium 400mg` / `Creatine 5 g` and matches names against compound `name` + `synonyms`.

### 15. Stack checker removes too much
The row remove button filters by compound id, so removing a doubled-up line deletes **all** contributing sources at once. Track entries by a stable id and let a single source be removed.

### 16. Claims are not linkable
Expanding a claim on a compound page changes no URL, so "creatine → cognition" cannot be linked or shared — a shame given per-claim grading is the core differentiator. Add a URL hash per claim in `src/islands/ClaimsBlock.tsx` and open the matching claim on load.

### 17. Nothing turns a regrade into a newsletter
The footer promises "one email when a grade moves" and there is no mechanism to send one. Build a script that diffs `history` entries between two git revisions and emits a draft email body; wire it to Buttondown manually at first.

---

## P4 — Polish

### 18. Mobile audit, especially the claims block
The spec names the claims block as the hardest mobile problem, and it has not been tested on a narrow viewport. The register table forces a 760px horizontal scroll (`src/islands/RegisterTable.tsx`); the claims block relies on flex wrapping that has never been checked.

### 19. Accessibility audit
Verify the constraints the spec sets: grade meaning must survive greyscale (badges carry letters, but confirm effect ticks and the amber species/funding channel do not rely on colour alone), visible keyboard focus, contrast ratios, and that the expandable claim rows announce state correctly.

### 20. Omega-3 has a no-op regrade
`src/content/compounds/omega-3.yaml` records `from: B, to: B`, which renders as "B → B" in the timeline and the register's movement column. Either drop it or add a distinct "reaffirmed" event type — the concept is genuinely useful, since re-reviewing without moving a grade is real editorial work.

### 21. Structured data
Consider JSON-LD (`Dataset` for the register, `MedicalWebPage`/`Article` for compounds) to help the JSON API and the grades get picked up properly.

---

## Notes for whoever picks this up

- `npm run build` is the content CI — a schema violation fails the build. Run it before assuming a YAML edit is valid.
- **Deploys can fail for non-build reasons.** Coolify waits on the container `HEALTHCHECK` and marks the whole deployment `failed` after ~130s if it never passes. A failed deploy leaves the previous container serving, so the site stays up. The API exposes no build logs — reproduce with `docker build` locally to diagnose.
- Coolify identifiers: project `s00sgk0scs4sokks8ogcg4c8`, environment `m0kkogc4cg44wkg4w4g88ssg`, application `z000gs4soooc40gw8ks0408c`, server `k804w00`. Deploy with `POST /api/v1/deploy?uuid=<app>`. The API token is in the `coolify` MCP server config, never in this repo.
- `SITE_URL` is a build-time env var in Coolify, not a repo file — changing the domain means changing it there.
- Voice rules are in the spec §8 and they are strict: no "boost", "optimize", "unlock", "supercharge". Where the honest answer is "nobody has tested this in humans", write that sentence in full.
