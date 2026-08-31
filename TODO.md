# Evidence Stack — backlog

Working state as of 2026-08-30: the site is **live** at https://evidencestack.sebastienwouters.dev, 20 compounds / 48 claims / 40 studies, all six MVP pages built, deployed from `main` via Coolify. See `README.md` for dev and deploy, `longevity-evidence-db-mvp.md` for the product spec.

**Read this first if you are an agent picking up work:** the P0 section is not ordinary backlog. This is a health-evidence site whose entire value proposition is that its claims are backed by real, checkable studies. It currently ships AI-drafted citations and fabricated product prices to the public internet. Fixing that outranks every feature below it. Do not add features while P0 items are open unless explicitly told to.

---

## P0 — Integrity. The live site currently misleads.

### 1a. How verification is recorded — **ADDED 2026-08-31, use this from now on**
Before this, verification state lived only in prose in this file, so a `funding` field checked against a fetched paper was **indistinguishable in the data** from one nobody had ever opened. That is not a bookkeeping nicety: it is how a trial funded by the maker of the tested product sat on the live site reading `not-declared`. Item 1 runs across many sittings; the record has to be in the data or it is not a record.

Each study may now carry a `checked` block, per field:

```yaml
checked:
  funding:
    on: 2026-08-31
    outcome: confirmed        # confirmed | corrected | unreachable
    source: https://www.ebi.ac.uk/europepmc/webservices/rest/PMC7128946/fullTextXML
    note: '"supported by grants from Coca-Cola and Quercegen Pharma"'
```

- **A `confirmed` or `corrected` check without a `source` fails the build.** You may not claim to have verified something without naming what you read. Proven to fire, both directions.
- **`unreachable` is a real result, not a failure**, and the one case that may omit `source`. Recording it stops the next pass burning a fetch on a paywall someone already hit. Roughly 40% of full texts are unreachable.
- Absent `checked` means **never checked**. Add further keys (`n`, `dose`, `note`…) as later passes happen; the shape is deliberately extensible.
- This is provenance for the *record*, not editorial sign-off. `reviewer` and `reviewed` at the compound level remain the only thing that lifts the draft marker, and they stay a human's to set.

Also added: **`funding: none`** for a paper that states outright it received no funding — a different fact from `not-declared`, which means the paper is silent. An explicitly unfunded independent trial is a meaningful signal to a reader and was previously flattened. Renders as "none received", because a bare "none" reads as *no funding data*, which is the opposite claim.

### 1b. `species: human-trial` — **ADDED 2026-08-31**
The claim-species enum offered only `human-rct`, `observational`, `rodent`, `in-vitro`, and a study surfaced that is none of them. **Nawarathna 2025** (l-theanine → attention) was recorded `design: RCT`; the paper describes itself as *"a double-blind, placebo-controlled, counterbalanced, two-way crossover trial"* and never claims randomisation — treatment order was assigned by splitting participants in half. The Sri Lanka registry agrees and says outright it is not an RCT. **Paper and registry agreed; the record was simply wrong.**

`human-trial` means interventional but **not** randomised: dosed, controlled, usually blinded, with allocation by counterbalancing, Latin square, alternation or open assignment. Calling such a study `human-rct` overstates it and `observational` understates it — participants were dosed and crossed over, which is nothing like a cohort. Crossover and counterbalanced designs are common in nutrition, so this will recur.

- Renders as `HUMAN TRIAL`. Buckets with `human` in the register filter — the badge carries the randomised/not distinction, not the filter.
- Verified through to the built output: the compound page, the register index and the per-compound JSON API all carry it.
- **The grade did not move, and the rubric is why.** B requires "at least one well-conducted human RCT", which this is not; C is "human data only, but small, short, mixed, or limited to surrogate biomarkers", which describes an n=37 single-dose crossover in sleep-deprived participants exactly. Non-randomisation *supports* the C rather than undermining it. No history entry needed.
- [ ] Worth a sweep during item 1: any other claim marked `human-rct` whose studies are crossover or counterbalanced. Nobody has checked the other 39.

### 1. Editorially verify all 20 compound records
Every record carries `reviewer: "draft — unverified"`. The citations, sample sizes, doses, funding sources, effect sizes and grades were drafted by an AI assistant from memory and **have not been checked against the primary sources**. Some may be subtly wrong; some may not exist.

- Files: `src/content/compounds/*.yaml`
- For each study: confirm the DOI/URL resolves, and that `n`, `duration`, `dose`, `design`, `funding`, `registry` and `outcome` match the paper. Then confirm the claim's `grade` and `effect` follow the rubric in `src/pages/methodology.astro`.
- The spec budgets 2–4 hours of real work per compound. This is the actual project cost — treat it as ~40–80 hours, not a cleanup pass.
- Done when: each verified file's `reviewer` is a real name and `reviewed` is the verification date. Until a record is verified, leave the draft marker in place — it is doing honest work.

### 2. Cost snapshot on compound pages is computed from invented products — **DONE 2026-08-30**
Resolved by hiding, not by sourcing real prices. The three fictional product records were deleted; `src/content/products/` is now deliberately empty (kept in git by a `.gitkeep`) and the schema still accepts products. The `.cost-strip` block in `src/pages/compounds/[id].astro` is gated on a snapshot existing, so it renders nothing at all rather than a placeholder, and returns unchanged the moment a real record lands. `costSnapshot()` in `src/lib/data.ts` already returned `null` for the empty case. The cost calculator's magnesium preload (`DEMO` in `src/islands/CostCalculator.tsx`) is labelled a worked example with invented prices, and its fake brand names were made neutral.

- Known side effect: the "OPEN CALCULATOR →" link lived inside the cost strip and no longer appears on compound pages. The header nav still carries it. Restore it outside the strip if the cross-link is wanted back.
- Still open, as a *content* task rather than an integrity one: sourcing real label data from real retailers so the snapshot can come back.

### 3. Fifteen of 48 claims have no studies attached — **DONE 2026-08-30, with caveats below**
All 15 filled, none removed. Every field was transcribed from a record fetched during the work, not written from memory. PubMed blocks automated fetching behind a cookie wall, so sourcing went through the **Europe PMC REST API** (`/search?resultType=core` for abstracts, `/PMC<id>/fullTextXML` where methods detail was needed). `reviewer: "draft — unverified"` and all `reviewed` dates are untouched — this item attaches evidence, it does not sign anything off. That is still item 1.

**Two verification tiers.** Ten records were transcribed from verbatim quoted source text. Five came back as source-attributed summary instead, because the fetcher enforces a quote-length cap: astaxanthin (skin/UV *and* lifespan), glutathione (skin brightening), hyaluronic acid (knee pain), lion's mane (nerve regeneration). **Those five have since had an independent second pass** — see item 3a. The other ten have not.

**The pipeline's real failure mode, observed once.** The agent wrote `registry: PROSPERO CRD42023463011` onto the taurine study — a plausible-shaped *field* on a real study — and caught and removed it itself. The risk here is not invented papers; it is invented metadata on genuine ones. Field-level checking is the thing that matters during item 1.

**Open editorial questions — do not let these sit:**
- ~~Astaxanthin → lifespan contradicts a later paper~~ — **resolved in 3a.** Korstanje 2026 is real, was retrieved in full, and is now its own study record; the claim carries `under-review`.
- ~~Lion's mane species contradiction~~ — **resolved in 3a.** `species` corrected `in-vitro` → `rodent`.
- **Vitamin D → fracture prevention**, `effect: small`: Chapuy 1992 found hip fractures 43% lower. That reads larger than `small`.
- **Quercetin → URI**, `effect: small`: the largest trial (n=1002) was flatly null; the positive result is n=40 plus a subgroup rescue. `small` may be generous.
- **Vitamin D → deficiency correction** was the worst case in this item — grade **A** with zero studies. It now has one dose-ranging trial (Gallagher 2012, n=163). One trial is thin support for an A. Re-check the grade against the rubric.
- `funding: public` on Harrison 2024 is defensible but not clean — NIA/NCI/VA are government, the Glenn Foundation is philanthropy.

Convention adopted (approved mid-task): `dose`/`duration` are required strings with no null mechanism, so unavailable values read **"not stated in the abstract"** rather than a guess. Used in 5 places.

### 3a. Independent second pass on the five weakest records — **DONE 2026-08-30. Read the conclusion; it changes how item 1 should be run.**
A second agent re-fetched all five sources itself rather than reviewing the first agent's reasoning, and checked every field.

**Where the first pass held up:** zero invented papers, zero invented registries, and every `cite`, `year`, `url`, `n`, `dose`, `duration`, `design` and outcome-measure transcribed correctly — including the genuinely hard `n` calls (treated arms in the field, control breakdown in the note).

**Where it failed, and it failed consistently in one layer — provenance and characterisation:**
- **Ito 2018 (astaxanthin → skin/UV): `funding: not-declared` → `industry`.** The paper states outright that three authors belong to FUJIFILM, "a sponsor and funder of this study", which also makes the product. A funder-of-the-study relationship was recorded as undeclared, on a site whose register carries an `industry-funded` flag as a headline signal.
- **Ito 2018: a real registry ID (`UMIN000028925`) had been dropped.** Combined with the invented PROSPERO ID on taurine, the registry field has now failed in *both* directions.
- **Ito 2018: the `note` had the result backwards** — it credited the self-rated outcomes, when the objective pre-specified primary was the significant finding and TEWL was null.
- **Arjinpathana 2012: outcome mis-attributed** — the melanin index was the primary, VISIA imaging the secondary; the field had swapped the instrument.
- **Tashiro 2012 and Wong 2011: notes shaded favourably.** Tashiro omitted that 22 of 60 dropped out and that the whole-sample primary never separated from placebo; Wong claimed the extract was "comparable to" the positive control when the paper says mecobalamin was "more advanced".

**The lesson for item 1, in the verifier's words: the numbers are not where the hours should go.** Funding and COI statements live in the last paragraph of the full text — exactly where an abstract-only fetch never reaches — and note fidelity against what the paper actually reports is the other soft spot. Verify those two things first on every record.

Also corrected: `species: in-vitro` → `rodent` on lion's mane. Korstanje 2026 retrieved in full (via NCBI efetch; Europe PMC lists it closed) and added as its own record with `under-review` on the claim — note that it is **not** a rerun of Harrison's conditions (roughly half the achieved dose, different starting ages), so it leaves the 2024 result unreplicated rather than overturned.

- [ ] **Unresolved tension, claim-level editorial work:** glutathione → skin brightening and HA → knee pain now carry an `industry-funded` claim flag over a study whose `funding` is `not-declared`. Justified by author-affiliation facts recorded in the notes (Kewpie R&D staff authored the HA trial and Kewpie made the tested product), but the flag and the field disagree on their face.
### 3b. Provenance pass on the remaining thirteen study records — **DONE 2026-08-30**
Same method as 3a, applied to the other records from item 3. **The diagnosis in 3a is confirmed exactly: the numbers are fine, the provenance is not.**

**Numbers: zero errors in thirteen records.** `n`, `dose`, `duration`, `design` and outcome measure spot-checked on every one, headline statistics re-derived on nine — including hard calls (Heinz's 1002 completers of 1023 recruited, Clark's 147-randomised/97-evaluable, Kumar's n=24 randomised rather than 36 studied). No invented papers, no invented registries. The taurine PROSPERO fabrication really was a one-off.

**Funding: four of thirteen were wrong. Registry: four were missing, all sitting in plain sight.**

- **quercetin → URI, Heinz 2010: `not-declared` → `industry`. This is the most important correction on the site.** The paper's own "Role of the funding source" reads: *"This work was supported by grants from Coca-Cola and Quercegen Pharma. Coca-Cola and Quercegen Pharma were involved in designing the study…"*, and the COI states the senior author *"holds a position on the science advisory board for Quercegen Pharma"* — which sells quercetin. The manufacturer of the tested product funded and helped design the trial. `industry-funded` was added to the claim's flags (previously `[]`) — **the one flag edit made; reverse it if you disagree.**
- **Heinz 2010, second omission: the supplement was not quercetin alone.** The chews carried vitamin C at the same milligram dose plus niacin, so nothing in that trial is attributable to quercetin by itself.
- l-theanine, Nawarathna 2025: `not-declared` → **`public`** (University of Peradeniya URG/2023/13/D + Ekhagastiftelsen 2023-142).
- glycine, Kumar 2023: `not-declared` → **`public`** (NIH/NIA R01AG041782, from publisher-deposited funding metadata).
- coq10, Kovacic 2025: `not-declared` → **`mixed`** — funding *was* declared (Society for Applied Vitamin Research, Jena). Neither public nor a named manufacturer; GVF's membership mixes scientists and pharmaceutical corporate members. **Review this call**; the verbatim sentence is in the note so it stays checkable.
- Registry IDs added: `INPLASY2023120081` (taurine), `PROSPERO CRD42023467604` (coq10), `SLCTR/2023/006` (l-theanine), `NCT00472823` (vitamin D — this one was in the *abstract*, but Europe PMC truncated it mid-sentence, along with "Primary Funding Source: National Institute on Aging").

**Notes: better than in 3a — nothing reversed, nothing spun — but consistently incomplete on the statistical fine print.**
- coq10, Kovacic 2025: I² = **93.3%**, and in the subgroup of trials that *required* statin-associated muscle symptoms for entry there was **no significant effect** (−0.94, CI −2.65 to 0.79). The significant pooled result comes from trials that did not select for the symptom the claim is about. That was the single most decision-relevant fact in the record and it was absent.
- taurine: I² = 84.9%; 18 of 25 trials reported no allocation concealment; the pooled populations are mostly patients (heart failure, diabetes, alcoholism), not adults with raised blood pressure.
- vitamin D, Chapuy 1992: the note asserted a nursing-home population with low calcium intake and low baseline 25(OH)D — **none of which is in any retrievable source.** Replaced with what the paper reports.
- glycine: removed an unsupportable "single group has published nearly all the GlyNAC literature" claim.
- collagen, Clark 2008: five of six significant pain measures were participant-rated, all under one point on a ten-point scale, and the highlighted effects come from a 63-person knee subgroup.
- tmg, Zawieja 2024 needed **no change at all** — the cleanest record in the set.

**Reachability, worth knowing before budgeting item 1: eight of thirteen full texts were unreachable.** Five genuinely paywalled; three nominally free but undeliverable (publisher 403s on two CC-BY/bronze papers, and Chapuy 1992 is a free NEJM PDF that is an image-only scan with no text layer and no OCR available). Those eight kept their existing `funding` value with the note now stating it could not be verified past the abstract.

- [ ] **Still disagreeing: collagen → activity joint pain** carries an `industry-funded` flag while both its studies read `not-declared`, because neither full text is reachable. Same shape as the glutathione and hyaluronic-acid tension in 3a.
- [ ] **Quercetin → URI `effect: small` now looks clearly wrong**, not merely generous: the n=1002 trial was null overall *and on every prespecified split*, the surviving positive is a post-hoc subgroup of 325, the only positive trial is n=40, the sponsor sells quercetin and helped design the study, and the product was not quercetin alone. `unclear` or `negligible` is closer.
- [ ] Confirmed as correctly graded, with better reasoning than the files gave: coq10 → statin myalgia at C, taurine → blood pressure at C/small.

**The method recommendation for item 1: run the funding/registry sweep mechanically across all 40 studies before anything else.** It is one full-text fetch per open paper, and it caught eight defects in thirteen records. Note fidelity is the slow job, and the failure mode to watch is not spin — it is omission of heterogeneity, attrition and subgroup nulls.

### 3c. Funding/registry sweep over the 34 pre-existing study records — **DONE 2026-08-30**
The records that predate item 3 had never been checked at all. Narrow sweep, `funding` and `registry` only. **34 checked, 12 full texts unreachable, 3 funding fields wrong, 4 registry IDs added, 1 replaced, 1 removed.**

**Two registry IDs were real-looking IDs belonging to entirely different studies** — the same failure as the invented taurine PROSPERO ID, and both verified against the ClinicalTrials.gov API:
- CoQ10 / Q-SYMBIO carried `NCT00374465`, which is *"Therapy With Verapamil or Carvedilol in Chronic Heart Failure"* (Medical University of Silesia). Replaced with `ISRCTN94506234`, printed in the paper's own abstract.
- Rapamycin / Mannick 2014 carried `NCT01190800`, which is *"Capacity Assessment in Persons With Alzheimer's Disease"* (AP–HP). **Removed** rather than replaced — the real registration is not on any reachable page, and substituting a guess is how the field got into this state.

Funding corrections: berberine/Lan 2015 `not-declared` → `public` (Chinese provincial funds, from deposited metadata only — flagged so it stays checkable); creatine/Lanhers 2017 `public` → `not-declared` (*"No sources of funding were used"*); magnesium/Mah & Pitre 2021 `public` → `not-declared`. Registry IDs added for creatine/Lyoo, creatine/Chilibeck, hyaluronic-acid/Oe, l-theanine/Hidese.

A trap worth recording: `CRD42019156594` appears in Mah & Pitre's text but belongs to *someone else's* melatonin review in the reference list. The paper says of itself that its protocol was not registered. Pattern-matching an ID out of a full text is not verification.

- [ ] **Flag missing where funding is industry — the headline of this sweep. `l-theanine` → acute stress & anxiety has `flags: []`** while Hidese 2019 is *"supported by funding received from Taiyo Kagaku Co., Ltd."*, two authors are Taiyo Kagaku employees, and that company *supplied the L-theanine and placebo tablets*. Identical shape to the quercetin/Heinz case. Not added — flags are yours.
- [ ] **New flag disagreement: `glucosamine` → knee osteoarthritis pain** carries `industry-funded` while both studies read `public`. Nothing in the record supports the flag.
- [ ] `mixed` funding with no flag, listed not adjudicated: ca-akg → healthspan (Ponce de Leon Health sells the tested product), nr-nmn → healthspan (sponsored research agreement with Oriental Yeast Co.), coq10 → statin myalgia.
- [ ] **Ten records keep a `funding` value that now stands explicitly unverified.** Worst: **Yamadera 2007 (glycine) carries `industry` and could not be checked at all** — the journal is not in Europe PMC and the publisher serves a cookie wall. Avgerinos 2018 (creatine → cognition) is reachable but has *no funding statement*; its `public` rests only on NIH intramural grant metadata.
- [ ] The enum has no value for "the authors state nobody funded this" — two papers say exactly that and are recorded as `not-declared`, which under-reports them. Worth a `none` category.

### 4 + 5. Contact route, imprint, privacy policy, newsletter consent — **PAGES BUILT 2026-08-30, BLOCKED ON FACTS**
`/about` and `/privacy` now exist, the footer carries a links row and a consent line under the signup field, and the methodology corrections paragraph renders from a single constant instead of pointing at an address that was never there. Every surface reads `CONTACT_EMAIL` in `src/config.ts`, currently `''` — while it is empty the site *says* no address is published, which is true, rather than printing a fake one. Setting that one constant flips the footer, `/about`, `/privacy` and `/methodology` to a working `mailto:` at once.

**These pages must not be deployed until the gaps below are filled.** They are marked in-page with a `.pending` block using the same idiom as the `draft — unverified` markers, so nothing currently lies — but an imprint full of TO BE CONFIRMED is not a published imprint.

- [ ] `CONTACT_EMAIL` — pick the address (a domain address keeps a personal inbox off a public page; needs forwarding set up first).
- [ ] Operator legal name for the about page's "Who runs it" section.
- [ ] Whether a postal address is required for the imprint, and which one. Threshold not assessed — needs your call, possibly someone qualified.
- [ ] Hosting provider name and access-log retention. nginx logs to stdout, Coolify retains container logs, retention period unknown.
- [ ] Transfer mechanism for sending addresses to Buttondown in the US.
- [ ] Which supervisory authority readers complain to — depends on member state.
- [ ] Verify Buttondown actually *deletes* on request rather than only suppressing. The privacy page commits to deletion; that promise has to be honourable through Buttondown's UI or API.
- [ ] "No separate copy of the list is kept outside Buttondown" is a promise about future workflow, not just about code. Keep it true.

Legal sufficiency was not assessed. The pages say what such pages need to say, with the facts left blank.

---

## P1 — Needed before promoting the site anywhere

### 6. Register the Buttondown account `evidencestack` *(user action, not agent)*
`BUTTONDOWN_USERNAME` in `src/config.ts` is set to `evidencestack`, but that newsletter does not exist yet — the signup form will 404 until it is claimed. If a different name is registered, change that one constant and redeploy.

### 7. Content depth is roughly half the spec
Spec calls for 3–6 claims per compound and 4–10 studies per compound: ~60–120 claims and ~80–200 studies. Current totals are **48 claims and 40 studies**. Fifteen of 20 compounds are thin stubs. Depends on item 1 — verify as you add, do not bulk-generate more unverified records.

### 8. Enable auto-deploy on push
No GitHub webhook is configured (`manual_webhook_secret_github` is empty), so every deploy is a manual API/UI trigger. In Coolify, enable the GitHub webhook for application `z000gs4soooc40gw8ks0408c` so pushes to `main` deploy themselves.

### 9. `robots.txt` and a 404 page — **DONE 2026-08-30**
`public/robots.txt` (new directory) points at `https://evidencestack.sebastienwouters.dev/sitemap-index.xml` — verified by curling the live site, not assumed. `src/pages/404.astro` uses the standard `Layout` and routes back into the register.

- `nginx.conf` had **no** 404 handling: every `try_files` ended `=404`, serving nginx's stock error page instead of the built `404.html`. Added `error_page 404 /404.html;` at server level (no `=`, so the 404 status is preserved).
- Caveat: a `public/` file cannot interpolate `SITE_URL`, so the robots sitemap URL hardcodes the domain. Changing the domain means changing that file too — or converting it to a `src/pages/robots.txt.ts` endpoint.
- Ignore `dist/sitemap-index.xml` showing `evidencestack.example.com`; that is a stale local build made without `SITE_URL`, and `dist/` is gitignored.

---

## P2 — Engineering hygiene

### 10. There are no tests — **DONE 2026-08-30**
Vitest added (devDependency only, no config file needed, no jsdom). Tests are co-located: `src/lib/cost.test.ts` (26) and `src/lib/stack.test.ts` (90). Run with `npm test`. **116 passed, 5 skipped, 0 failed**; `tsc --noEmit` clean project-wide.

Covered: cost-per-gram-of-active against hand-computed values rather than the code's own output, oxide-vs-citrate at equal label price, form-factor regression pins and invariants; the UL boundary tested *exactly on* 350 as well as either side, the under-studied boundary exactly on `studiedMinMg/2`, UL crossed on the merged total rather than per entry; duplicate merging including the trim/lowercase normalisation and the source ids the per-source ✕ depends on; share-URL round-tripping with 22 malformed payloads, none of which throw. Two properties are pinned deliberately: **ids never reach the encoded URL**, and **a link encoded before the id refactor still decodes** — the latter via a frozen base64 literal marked "do NOT regenerate with `encodeStack`", since generating it from current code would make the test circular.

The 5 skips are the real bugs below, sitting under a `KNOWN BUGS` heading with the crafted payloads in comments, so un-skipping after a fix is a one-line change. They were verified to genuinely fail before being skipped. Skipped rather than left red so item 11 (CI) can land against a green baseline — flip them to `it` if you would rather CI shout.

### 10a. `decodeStack` did not validate the whole tuple — **FIXED 2026-08-30. Suite now 121 passed, 0 skipped.**
`decodeStack`'s guard now requires `Number.isFinite(p[2]) && p[2] >= 0`, and `monthlyEur` is repaired to `undefined` unless it is a finite positive number. Rule applied: **a field with a meaningful "absent" value is coerced to it; a field the entry cannot exist without drops the tuple.** So `compoundId` (null = unmatched) and `monthlyEur` (undefined = no cost) are repaired, while a bad `name` or `dailyMg` drops that tuple and keeps the rest — matching the behaviour already pinned by passing tests. A negative dose is dropped rather than clamped to 0, because clamping would leave a phantom source on the merged line and could falsely mark it `duplicated`. `encodeStack` and the share-URL format are byte-for-byte unchanged; the frozen legacy fixture still decodes. All 5 previously-skipped tests are un-skipped with no assertion weakened.

Left as observations, not bugs: a share URL can mint a `dailyMg: 0` entry that the island's own add guard (`!(dailyMg > 0)`) could never produce; `-0` passes the non-negative check and renders as 0; a 3-element tuple still decodes since `monthlyEur` is genuinely optional.

Original diagnosis, kept for the record:
`decodeStack`'s tuple guard in `src/lib/stack.ts` checks only `p[1]` and `p[2]`, and only by `typeof`. Nothing throws — hostile input never reaches the island as an exception — but a crafted `?s=` param can put values into `StackEntry` that its own type forbids.

1. **A negative dose cancels a real one.** `[["magnesium","a",400,0],["magnesium","b",-400,0]]` merges to a total of **0 mg, not 400**. A shared link can therefore hide a genuine overdose behind a green "within studied range" verdict, on the one tool whose entire purpose is flagging that. This is the one that matters.
2. **`Infinity` is accepted as a dose**, rendering "Infinity g/day" and producing a confident OVER THE UPPER LIMIT verdict for a dose that does not exist.
3. **`p[3]` (`monthlyEur`) is not validated at all.** A string there makes `a + (e.monthlyEur ?? 0)` concatenate instead of add, so `monthlyEur > 0` goes false and the "€X/month total" line and per-line cost notes **silently vanish**; the sort comparator returns `NaN` and line order goes arbitrary.

- Fix by validating every tuple element and requiring `Number.isFinite` and a non-negative dose, then un-skip the 5 tests.
- Unrelated quirk documented in the suite, not asserted as a bug: `studiedMaxMg` is verdict-inert — `analyzeStack` reads only `studiedMinMg` and `ulMg`, so a guide with only a studied *maximum* returns `no-data` at any dose. Whether that should flag is a product decision.
- Known and untested: `btoa(String.fromCharCode(...bytes))` in `encodeStack` will hit `RangeError` on multi-thousand-entry stacks. Real, but outside plausible use.

### 11. There is no CI — **DONE 2026-08-30**
`.github/workflows/ci.yml` runs on push and pull request: checkout → setup-node → `npm ci` → `npm run check` → `npm run build` → `npm test`.

- **Node 22**, matching `FROM node:22-alpine` in the `Dockerfile`. CI that passes on a different major than production is worth less. npm cache keyed on the lockfile.
- `SITE_URL` is set inline to the real domain rather than left to the fallback. The build succeeds either way, so this is about what CI *validates*: unset, it would produce canonicals and a sitemap pointing at `evidencestack.example.com` — the exact placeholder that already caused confusion once (see item 9). A repo variable was rejected because an unconfigured one expands to empty and drops back to the placeholder invisibly. **Cost: changing the domain is now three edits — Coolify, `public/robots.txt`, and this workflow.**
- No deploy step, deliberately. Deploys stay manual through Coolify; automating them is item 8 and the user's decision.
- `on: [push, pull_request]` double-runs on a branch with an open PR. Accepted rather than adding branch filters.
- **The first run only passes if the whole batch is committed together.** At the previous HEAD there is no `test` script, no vitest and no test files, so a commit containing only the workflow would fail on `npm test`. `package.json`, `package-lock.json` and both test files must land in the same push.

### 12. Security headers — **DONE 2026-08-30, needs one browser check after the next deploy**
`nginx.conf` now sets `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` and a CSP, all with `always`. The CSP was derived from what the built output actually contains, not from assumptions about Astro.

- **The block appears four times on purpose.** nginx *replaces* rather than merges inherited `add_header` directives, so a location block that sets any header loses every server-level one. All three locations set `Cache-Control`, so a server-level-only block would have been silently discarded on every request. Keep the four copies in sync — the file comments say so.
- `'unsafe-inline'` is required in **both** `script-src` and `style-src`, and this is not provisional: Astro emits two inline runtime scripts on every island page, and the SSR'd islands emit ~2,149 inline `style="…"` attributes, which CSP hashes cannot cover at all. So this CSP blocks external script origins but **not injected inline script** — a real improvement, not full XSS protection.
- `form-action` must keep `https://buttondown.com` — the newsletter is a native cross-origin form POST because Buttondown sends no CORS headers (`Footer.astro`).
- `img-src`/`font-src` need `data:` — the favicon is a data URI and two font faces are base64-inlined in the CSS.
- Script hashes were computed but deliberately **not** shipped: a hash's presence makes browsers ignore `'unsafe-inline'`, so a byte-mismatch from a stale build would silently kill hydration on all island pages. Upgrading to hashes needs a fresh build plus a browser check, and Astro upgrades change those bytes.
- HSTS deliberately omitted — TLS terminates at Coolify's proxy, so it is a proxy-layer decision.
- [ ] **After the next deploy, load with devtools open** and confirm no CSP violations on: home, a compound page (hydrates `ClaimsBlock`), `/tools/stack-check`, `/tools/cost-per-gram`, `/404`, `/about`, `/privacy` — plus one real newsletter submit to confirm the cross-origin POST navigates rather than being blocked. CSP failures are silent in production.

### 13. No social preview image
Regrade events getting shared is an explicit success criterion in the spec, and shares currently render with no image. Add a typographic `og:image` (per-compound would be better: name + grade). No stock photography, per the design constraints.

---

## P3 — Spec features not yet built

### 14. Stack checker cannot accept a pasted list — **DONE 2026-08-30**
`parseStackPaste()` and `buildCompoundIndex()` live in `src/lib/stack.ts`, not the island — the "never silently mis-parse" constraint is a property of a function, and a function is testable. The island re-runs it in a `useMemo` on every keystroke for a live preview, and mints `newEntryId()` per line only at commit time. **52 new tests; suite now 189 passing, 0 skipped.**

Grammar: the dose is **anchored to the end of the line**, which is what makes digit-bearing names (`CoQ10 100mg`, `Vitamin B12 1000 mcg`, `5-HTP 100 mg`) safe. Accepts mg/g/mcg/µg with plurals and spelled-out forms, strips bullets and `/day`-style suffixes, and matches over three exact-key tiers (name + synonyms → derived spellings → punctuation-squashed). **No substring or fuzzy matching**, and a key two compounds both claim is dropped so the line stays unmatched — a wrong match is a wrong upper-limit verdict.

**IU is rejected, never converted, and the reasoning should survive any future "improvement":** the IU→mass factor is compound-specific (vitamin D 0.025 µg/IU, vitamin E 0.67 or 0.45 mg/IU depending on isomer, vitamin A 0.3 µg) and `content.config.ts` holds no field for it, so converting would mean sourcing a factor from an agent's memory — the exact failure this project has already observed. There is also no "dose present but unknown" encoding: `dailyMg` is a required number feeding a summed total, so *any* value contaminates the verdict and 0 adds a phantom source. Rejection is the honest encoding, not the lazy one. `IE` and `I.U.` route to the same message.

Rejected with a plain reason naming the problem: `1,000` and `1,5` (comma is 1.5 in Brussels and 1500 in London), `1.000` (dot ambiguous — but `0.025 mg` still parses), `2 x 200 mg` multipliers, two doses on one line, `1 tablet`/`1 scoop`/`2 capsules`, a number with no unit, a dose not at the end of the line, and `0 mg`.

Unmatched names are **added, not dropped** — `compoundId: null`, labelled "not in the register — added as typed" — because dropping them understates what someone is taking. Rejected lines stay in the textarea with their reasons after the accepted ones are added; nothing vanishes silently, and the converted mg (`5 g → 5000 mg/day`) is on screen before anything is committed.

- Deviation, declared: one line added to `src/lib/data.ts` (`synonyms?: string[]` on `DoseGuide`, optional so no caller changed) because synonyms otherwise never reach the island and the only other routes were a hardcoded table that would drift from `src/content/**`, or shipping synonym matching that matches nothing.
- [ ] **Content, not code:** `Mg 400 mg`, `vit d3 100 mcg`, `mag citrate 200mg`, `creatine mono 5g`, `Collagen 10 g` (register name is "Collagen peptides") all parse with the right dose but stay unmatched, because those abbreviations are not in `synonyms`. Adding them to the YAML fixes it. A fuzzy fallback was deliberately not added.
- Three silently-wrong-number bugs were found by probing and are now guarded and tested: `Magnesium .4 g` (was 4000 mg), `Magnesium 1.000 mg` (was 1 mg), `Magnesium 4e2 mg` (was 2 mg).

### 15. Stack checker removes too much — **DONE 2026-08-30**
`StackEntry` now carries a session-local `id` (`newEntryId()` in `src/lib/stack.ts`: `crypto.randomUUID()` with a counter fallback, because `randomUUID` is undefined over plain http). `StackLine.sources` went from `string[]` to `{ id, name }[]`, so each contributing source is individually addressable, and a doubled-up line now renders a small ✕ per source — you can drop one product and watch the total fall instead of losing the evidence for the warning. Line divs also gained `key` props; they previously had none at all.

- Share URLs are unchanged. `encodeStack` and the `Packed` tuple are untouched and ids are minted on decode, so links shared before this still decode correctly.
- Duplicate detection is unaffected — `analyzeStack` groups on compound id / normalised name and never sees `id`.
- **Second bug found and subsumed:** the old remove compared `e.name === l.name` exactly while grouping trims and lowercases, so `"Vit C "` and `"vit c"` merged into one line but ✕ removed only the exact match, orphaning the other into a phantom line. Id-based removal fixes this too.
- Not done, and still open as item 14: parsing a pasted list.

### 16. Claims are not linkable — **DONE 2026-08-30**
Claims now carry a bare slug hash off the outcome — `/compounds/creatine/#cognition-in-healthy-adults` — with a `LINK TO THIS CLAIM` anchor in the expanded panel. Only `src/islands/ClaimsBlock.tsx` changed.

- Slugs come from the `outcome` string, not the index, so reordering claims (which item 1's editorial work *will* do, since they sort best-supported first) never changes a unique claim's hash. Collisions take the lowest free `-2`, `-3` suffix against the whole used-set; only two claims sharing an identical outcome string can swap suffixes on reorder.
- `replaceState` on every toggle, matching `StackChecker.tsx` — expanding a row is view state, not navigation, so ten toggles must not cost ten presses of Back. Closing strips the fragment rather than leaving a bare `#`.
- Scroll-on-load works twice over: `id` is on the server-rendered row so the browser's native fragment scroll fires **before hydration**, and the open claim is resolved in the `useState` initialiser rather than an effect, so there is no collapsed flash.
- Accessibility improved rather than held: `aria-controls` was **absent** before and is now set (only while expanded, so it never dangles), and rows gained `key` props they did not have. The permalink is a plain `<a>` — right-click-copy, no clipboard API, since the CSP work notes clipboard is unavailable over plain http.
- The anchor is in the panel, not the heading: the heading sits inside a `<button>`, and an `<a>` nested in a `<button>` is invalid nested-interactive markup. Hard constraint, not preference.
- [ ] Needs eyes in a browser: the SSR-collapsed → hydrated-open transition on a hash load, Back/Forward firing `hashchange`, and the panel's label row wrapping on a narrow viewport (see item 18).

### 17. Nothing turns a regrade into a newsletter — **DONE 2026-08-30**
`scripts/regrade-draft.mjs`, run as `npm run regrade-draft` (default `HEAD~1..HEAD`; pass `<tag>..HEAD` for a real send, since "since the last email" is something git cannot infer — tag each send). **It sends nothing** — audited for `fetch`, `node:http(s)`, `node:net`, `node:dns`. stdout is only the pasteable draft; every warning goes to stderr, so `> draft.txt` gives a clean body.

- **Reaffirmations cannot cause an email to exist.** They render in a separated "Also re-reviewed, grade held" block *below* the moves, never in the subject or the count; a commit landing only omega-3's reaffirmation produces 0 bytes on stdout. The tension is real and was argued rather than ignored — the footer says "regrade events only", and an "also" section is how a digest starts — so `--moves-only` exists as a one-flag escape hatch instead of a forked script.
- A `move` with `from === to` is rejected into neither section with a loud warning. Not hypothetical: omega-3's entry *at the committed HEAD* is exactly that unmarked `B → B`, and the script reads old revisions where that was still valid.
- The slug rule is now genuinely shared — `src/lib/claim-slug.js`, imported by both `ClaimsBlock.tsx` and the script, so an email cannot link to an anchor the page does not render. **Keep it `.js`**: a plain-`node` script can only import `.ts` under `--experimental-strip-types`, flagged on Node 22.17 and unflagged later — an npm script that breaks on a Node bump. 16 tests pin the collision cases.
- `yaml@2.9.0` is only a *transitive* dep of Astro's tooling, so it is imported via a guarded dynamic `import()` that fails with the one-line fix if it vanishes. No fallback parser was written — a second YAML implementation reading content that zod validates would be its own drift source.
- Upgrades and downgrades use an identical template, with the `why` verbatim and no softening, and the A–E explainer at the bottom so it reads the same whichever way a grade moved.

### 17a. `history[].claim` does not match any claim's `outcome` — **found by the newsletter script, NOT fixed**
In **2 of the 3** real regrade records the history entry names a claim that does not exist:
- `ca-akg`: history says `slower biological aging`, the claim is `slower biological aging (methylation clocks)`
- `magnesium`: history says `sleep quality in older adults`, the claim is `sleep quality in older adults with low magnesium`

The script refuses to guess an anchor and links to the compound page instead, warning on stderr — prefix or fuzzy matching is guessing with extra steps, and a silently-wrong anchor loads at the top of the page where nobody learns it broke.

**FIXED 2026-08-30.** Both strings now match their claim's `outcome` exactly, and a `superRefine` on the compound object (it needs `claims` and `history` in scope, so it cannot sit on the history-entry object beside the `move`/`reaffirmed` refine) makes a mismatch a **build failure**, naming the offending string and listing the valid outcomes. Proved to fire by reverting `ca-akg.yaml` and watching the build fail, then restoring it. All 20 compound files pass.

### 3d. Three citation links pointed at the wrong paper or nowhere — **FIXED 2026-08-30**
Found by the 3c sweep, each independently re-resolved before editing and checked field-by-field against the record rather than by citation shape.

- **magnesium / Simental-Mendía 2016** — `10.1016/j.phrs.2016.07.019` resolved to *"Immunotherapy: A promising approach to reverse sepsis-induced immunosuppression"*. Same journal and volume as the intended paper, which is how one digit did this. → `…2016.06.019`.
- **tmg / Olthof 2003** — `10.1093/ajcn/77.5.1187` returned HTTP 404. The replacement is in a *different journal*, so it was verified against every field before use: four groups of 19 = n 76 ✓, 6 weeks ✓, 1.5/3/6 g/day ✓, plasma homocysteine ✓, 12/15/20% reductions against the note's "~10–20%" ✓. → `10.1093/jn/133.12.4135`.
- **magnesium / Peikert 1996** — off by one digit. Verified: 81 patients ✓, 600 mg for 12 weeks ✓, 41.6% vs 15.8% against the note's "~42% vs ~16%" ✓.
- **creatine / Chilibeck 2023** — had **no `url` at all**. Added, verified: 237 postmenopausal women ✓, 0.14 g/kg/day ✓, 2 yr ✓, no BMD effect ✓ matching `effect: negligible`.

- [ ] **Flagged during the fix, needs item-1 attention:** the Simental-Mendía record's `design: meta-analysis of 18 RCTs`, `n: 670` and `duration: 4–24 weeks` appear nowhere in the abstract, and its note says "improvements in fasting glucose" when the paper reports fasting glucose as **null overall** (p=0.119), significant only in a ≥4-month subgroup. The link is now correct; the fields around it are not.
- [ ] **Should `url` be required?** A sweep found 59 study records and exactly one missing a `url` — now fixed — so the schema change would be free today. Argued both ways and worth reading before deciding: requiring it removes a gap that only a dedicated agent noticed, **but this repo's documented failure mode is fabrication under pressure** (one invented PROSPERO ID, two real IDs belonging to other studies), and a required field is exactly the shape that produces those. A wrong URL is strictly worse than a missing one — a blank is visibly honest, while the sepsis DOI misled readers confidently for months — and `z.string().url()` only checks syntax, so it would convert a visible gap into an invisible lie. Recommendation: require it, but only because the register is small enough to fill honestly right now, and pair it with a resolve-check, since a schema can enforce presence and only a fetch can enforce correctness.

---

## P4 — Polish

### 18 + 19. Mobile and accessibility audit — **AUDITED 2026-08-30, fixes dispatched separately**
Measured in headless Chrome against the real built `dist/`, served with the **exact** production header set from `nginx.conf` (`npm run preview` sends no CSP, so that was the only way to test the real policy). Viewports at true 320/375/768 CSS px.

**The CSP is clean.** Zero violations and zero console errors across all eight page types, checked *after* interaction — expanding claims, filtering, pasting a stack, driving the calculator. Verified as a real result by a negative control: an injected external script and image were both correctly blocked. Item 12's residual risk is retired except for the newsletter POST, which was not submitted.

**Confirmed defects, most severe first:**
1. **Every page scrolls sideways on a phone.** `.signup` in `Footer.astro` has `min-width: auto` and the email input's min-content is 265px, flooring the form at 386px. Body overflow **+90px @320, +35px @375**, on *every page*. The SUBSCRIBE button is sliced off and the consent sentence runs off-screen mid-word. Fix verified: `min-width: 0` on `.signup` → 0px overflow.
2. **Claim permalinks report the wrong state to assistive tech** — item 16's "needs eyes" checkbox fails. Loading `#<claim>` opens the panel visibly, but the button keeps its server-rendered `aria-expanded="false"` and gets no `aria-controls`, because Preact hydration reuses the SSR button and does not re-apply attributes that differ. Chrome's accessibility tree reports `expanded=false` while the studies are on screen. Self-corrects after one toggle.
3. **Arriving from the home-page search shows a blank search box.** `/compounds/?q=creatine` filters correctly to one row but the input renders empty — same hydration family. This is a primary flow: the home search is a GET form posting to `/compounds/`.
4. **The claims block forces horizontal page scroll on every compound page** (the spec's "hardest mobile problem", now measured). `.table-head`'s fixed columns floor at 436px and, unlike `RegisterTable`, the card has **no** `overflow-x`, so it escapes to the page: **+141px @320**. The rows below wrap into 5 stacked lines, so the one-line header labels columns that no longer exist.
5. **Study cards clip their own text at 320px** — `minmax(300px, 1fr)` inside a 230–272px container. Captured mid-word: `design meta-analysi`, `funding not-declare`.
6. **Register table's 760px scroll confirmed at 764px** — needs horizontal scroll below ~810px, *including 768*. But `overflow-x: auto` contains it, so it never scrolls the page. Works as designed; the cost is that at 320 only a third of a row is visible.
7. Two marginal contrast results out of 82 combinations checked: footer `·` separators at 1.53:1 (decorative, arguably exempt — `aria-hidden` + `--muted` fixes it either way), and the claims chevron when expanded at 4.25:1 (passes as a non-text state indicator, fails as text).
8. No skip link on any page (WCAG 2.4.1 Level A). Outside what item 19 names; flagged as a bonus.

**Tested and fine:** grade meaning survives greyscale comprehensively — effect ticks carry the word as well as the fill, species/funding/flags are all words with amber purely redundant, badges carry the letter plus an `aria-label`. All 42 tab stops show a visible focus ring with sane order. The item-16 permalink wraps cleanly at 320 rather than crushing the micro-label. Item 14's paste card is clean at 320. 768px has zero overflow. One `h1` per page, no heading jumps, landmarks present.

- [ ] **Not checked, worth doing:** real iOS Safari (defect 1 is an intrinsic-sizing bug and Safari differs), an actual screen reader rather than Chrome's accessibility tree, and **the newsletter POST — the one CSP directive still unexercised, and the one most likely to bite, since a blocked cross-origin POST fails silently.**

**Defects 1–5 and 7 FIXED 2026-08-30.** Defect 6 (register's 760px scroll) and 8 (skip link) deliberately not done — the former is contained by its own `overflow-x` and shrinking column bases is a design decision, not a defect fix.

- `.signup` gets `min-width: 0`. Nothing else relied on the old floor; the button's own `min-width: auto` still protects it.
- **The ARIA fix kept the no-flash behaviour** rather than taking the audit's suggested trade. The `useState` initialiser is untouched; a ref plus a mount effect writes the two attributes the server could not know. The mechanism was confirmed by reading Preact 10.29.8's source, not assumed: `diffElementNodes` skips non-function props while `isHydrating`, which is the root cause; refs are applied from `refQueue` in `commitRoot` **before** `_renderCallbacks`, so the ref is populated when the effect runs; and later diffs compare vnode props to vnode props, so closing the row still clears both attributes normally. Both halves of the decision are cross-referenced in the file so neither gets "simplified" away.
- The `?q=` fix uses the same idiom, with the same source-confirmed cause: during hydration Preact re-applies `value` only for `<textarea>`.
- The claims header needed a second class (`claims-head`) because `.table-head` is shared with `RegisterTable`, whose header must keep its 760px scroll inside its own container. Hidden below 460px rather than wrapped. Residual overflow 4px, down from 141px — not chased to zero, since that means shrinking the claim cell's `minWidth`, an unmeasured design tweak.
- Study grid `minmax(300px, 1fr)` → `minmax(min(300px, 100%), 1fr)`. Footer separators `aria-hidden` + `--muted`; claims chevron `--muted-2` → `--muted`. No new colour token.

### 20. Omega-3 has a no-op regrade — **DONE 2026-08-30, and it exposed two more bugs of the same family**
Took the "reaffirmed event type" route rather than deleting the entry, because re-reviewing a compound and deciding the grade should *not* move is real editorial work and worth showing.

- Schema: `kind: z.enum(['move','reaffirmed']).default('move')` on a history entry, plus a `superRefine` enforcing the pairing **both ways** — a `move` with `from === to` is now a build error, and so is a `reaffirmed` with `from !== to`. The old nonsense cannot recur silently.
- Chosen over a discriminated union because `regradeEvents` in `src/lib/data.ts` reads `h.from`/`h.to` unconditionally; a union would have broken `tsc` there. The discriminator keeps the inferred type a strict superset, so every existing consumer typechecks untouched.
- All 20 files verified against the *actual* schema (loaded from `content.config.ts` with the `astro:*` imports shimmed): 20/20 pass, with negative controls confirming an unmarked `B→B` is rejected.
- Renders as `cardiovascular events: B held` + a mono `REAFFIRMED` tag on the compound timeline, and `B held · 2025-12` in muted mono in the register — green is reserved for actual movement.

**Two latent bugs found and fixed while in there**, both the same mistake in new places:
- The home page's "Recently regraded" card would have listed a reaffirmation as a regrade.
- `src/pages/api/compounds.json.ts` computed `lastRegrade` from entries of *any* kind, so omega-3 would have reported `lastRegrade: "2025-12"` when no grade had moved. Now counts `kind === 'move'` only, and correctly reports `null`.

- [ ] Recorded, not fixed: "Sort: recent movement" still ranks omega-3 by its reaffirmation date, because `lastMoveDate` is computed in `src/lib/data.ts` (out of that agent's scope). Coherent now that the cell says "held", but worth tidying.
- [ ] Pre-existing oddity worth knowing: `data.ts` takes `lastMove` from `history[0]` but `lastMoveDate` from the max date. Harmless while every history is a single entry.
- Not covered by any check that could be run: the `.astro` *template* markup was never compiled. The build will be its first real test.

### 21. Structured data — **DONE 2026-08-30**
A `Dataset` node on `/compounds/` and one per compound page, built in `src/lib/jsonld.ts`. The register node points at the real `/api/compounds.json` as a `DataDownload`, and describes what the register *records* via `variableMeasured` — including, in words, that a grade "describes how well studied a claim is, not how well a product works, and it is not a recommendation". The description carries a **computed** draft count, so it corrects itself as item 1 proceeds rather than going stale. Per-compound nodes carry `creativeWorkStatus: "Draft"` gated on the reviewer marker — it disappears once a real name lands, rather than flipping to a "Published" claim.

**What was deliberately not emitted matters more than what was**, and it is pinned by *failing tests* — a `FORBIDDEN_KEYS` deep-key sweep and a deep `@type` sweep — so adding any of it breaks the suite:
- `Article`/`ScholarlyArticle` — presuppose an authored, edited work and effectively require `author`. Nothing here is signed off.
- `MedicalWebPage`/`Drug`/`DietarySupplement` — health-authority vocabularies asserting clinical guidance, which `DISCLAIMER` explicitly disclaims.
- `aggregateRating`/`Review`/`ratingValue` — a grade is a statement about evidence, not a product score. **No grade letter is emitted as a value anywhere.**
- `publisher`/`author`/`Organization`/`logo` — `CONTACT_EMAIL` is empty and the legal name is open. **Known cost, taken knowingly: Google wants `publisher` on a `Dataset`, so the register may not qualify for Dataset rich results until items 4+5 are filled.** That is what unblocks it.
- `datePublished`/`dateModified` — `reviewed` is a review date, not a modification date, and the two have already diverged (3a/3b edited records without touching `reviewed`). A provably wrong date is worse than none.

- `serializeJsonLd` escapes `<` and U+2028/29; tested against a compound named `Creatine </script><img src=x onerror=alert(1)>`. `set:html` is load-bearing — as a plain child expression Astro would escape every quote and emit an unparseable block.
- [ ] Noted, out of scope: `studyCount` sums per-claim study lists, so a paper cited under two claims counts twice. The JSON-LD now says "study entries listed as the evidence behind them"; the `<meta name="description">` on compound pages still says "graded against N studies" and carries the same overcount.

---

## Before launch — undo the beta lockdown

**The site is behind HTTP basic auth.** Enabled 2026-08-30 in Coolify → `evidencestack` → Configuration → General → HTTP Basic Auth. It runs at the Traefik proxy, *in front of* the container, which is why the `HEALTHCHECK` (`wget http://127.0.0.1/`, below the proxy) still passes and deploys still go `running:healthy`. Verified: every path returns 401, including `/api/compounds.json` and `/api/compounds/<id>.json` — a rule covering only `/` would have left the whole register readable as JSON.

- Nothing about it lives in this repo, so there is no credential in git and nothing to strip out. Turning it off is the same two fields in the Coolify UI.
- It is **not** a substitute for the noindex below, and vice versa. Auth stops crawlers with a 401; the noindex still stands if auth is ever lifted for a demo or a stakeholder. Two independent switches, deliberately.
- Credentials confirmed working 2026-08-31. Worth knowing for next time: an outside check can only prove auth *denies* — a mis-entered password looks identical from there, 401 either way. Someone has to log in to prove the other half.

### Undo the beta noindex

**The site is deliberately not indexable.** Three places enforce it and **all three must change together**, or the site half-launches:

1. `NOINDEX = true` in `src/config.ts` → set to `false`. Removes `<meta name="robots" content="noindex, nofollow, noarchive">` from every page and restores the `<link rel="sitemap">`.
2. `nginx.conf` → delete all four copies of the `X-Robots-Tag` line. This is the authoritative half: it covers the JSON API, the sitemap and every non-HTML response, which a meta tag cannot reach.
3. `public/robots.txt` → uncomment the `Sitemap:` line.

**Do not "fix" this by adding `Disallow: /`.** robots.txt governs crawling, not indexing. A disallowed URL can still be listed in results from third-party links, and a blocked crawler never fetches the page — so it never reads the noindex and the URL stays indexed. Blocking would make the site *more* likely to appear, not less. Crawling is allowed on purpose.

Verify after any change to this, on the live site:
```
curl -sI https://evidencestack.sebastienwouters.dev/ | grep -i x-robots-tag
curl -s  https://evidencestack.sebastienwouters.dev/ | grep -i 'name="robots"'
```

---

## Notes for whoever picks this up

- `npm run build` is the content CI — a schema violation fails the build. Run it before assuming a YAML edit is valid.
- **Deploys can fail for non-build reasons.** Coolify waits on the container `HEALTHCHECK` and marks the whole deployment `failed` after ~130s if it never passes. A failed deploy leaves the previous container serving, so the site stays up. The API exposes no build logs — reproduce with `docker build` locally to diagnose.
- Coolify identifiers: project `s00sgk0scs4sokks8ogcg4c8`, environment `m0kkogc4cg44wkg4w4g88ssg`, application `z000gs4soooc40gw8ks0408c`, server `k804w00`. Deploy with `POST /api/v1/deploy?uuid=<app>`. The API token is in the `coolify` MCP server config, never in this repo.
- `SITE_URL` is a build-time env var in Coolify, not a repo file — changing the domain means changing it there.
- Voice rules are in the spec §8 and they are strict: no "boost", "optimize", "unlock", "supercharge". Where the honest answer is "nobody has tested this in humans", write that sentence in full.
