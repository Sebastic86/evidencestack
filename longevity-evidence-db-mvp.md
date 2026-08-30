# MVP proposal — supplement evidence database

*Working name: TBD. Candidates: Evidence Stack, Halfwaarde, Nulmeting, The Compound Register.*

---

## 1. The product in one sentence

A searchable register of longevity supplements where every compound is graded per health claim against the actual studies behind it, plus two tools that answer the questions people ask right after: *what am I really paying per gram?* and *is my stack doubling up?*

## 2. Why this and not another blog

The field is full of reverse-chronological news feeds where knowledge scrolls away, and of supplement-shop content marketing with a conflict of interest baked in. This is neither. The unit of value is the **compound record**, not the article. News items attach to a record and move its grade; the article feed is a byproduct of the database, not the point of the site.

Two positioning rules that everything else follows from:

- **Grades are per claim, not per compound.** Creatine is not "good." Creatine for muscle mass is well supported; creatine for cognition in healthy adults is not. Any site that gives a compound one score is lying by simplification. This is the core differentiator and should be visible in the first three seconds of the compound page.
- **Species is never hidden.** Mouse results and human RCT results never share a visual treatment. This is the single most common way longevity content misleads people.

## 3. Scope

**In for v1**

1. Compound register — 20 seed compounds, searchable and filterable
2. Compound detail page with per-claim grades and the studies behind each grade
3. Cost per gram of active — calculator
4. Stack overlap checker
5. Methodology page explaining the grading rubric in full
6. Newsletter signup

**Explicitly out of v1**

User accounts, comments, product/brand reviews, book reviews, podcast digests, a news feed, affiliate links, biological-age calculators, interaction checking against medication. All are plausible later; none are needed to prove the idea.

## 4. The grading system

This is the heart of the product and needs the most design attention.

### Two axes, never collapsed into one

**Evidence grade** — how much do we know?

| Grade | Meaning |
|---|---|
| **A** | Multiple human RCTs, consistent direction, independently replicated, hard endpoints |
| **B** | At least one well-conducted human RCT, or consistent human observational data with a plausible mechanism |
| **C** | Human data only, but small, short, mixed, or limited to surrogate biomarkers |
| **D** | Animal or in-vitro only. No human evidence for this claim |
| **E** | Tested in humans and found not to work, or contradicted by the better studies |

**Effect size** — if it works, how much? Shown separately as *large / moderate / small / negligible / unclear*. A compound can be grade A with a negligible effect, and that combination is one of the most useful things this site can tell someone.

### Flags

Small, factual, shown on both the claim and the individual study:

- `Industry funded` — the study was paid for by a party selling the compound
- `Biomarker only` — measured a proxy, not an outcome anyone feels
- `Rodent only`
- `Dose mismatch` — the studied dose is far from what supplements actually contain
- `Safety note` — documented upper limit, contraindication, or interaction class
- `Under review` — new evidence has arrived and the grade hasn't been reassessed yet

### Grade movement

Every claim carries a dated grade with its history. When a new study moves a grade, that change is a first-class event: shown on the compound page as a timeline, and it becomes the site's news stream. *"Ca-AKG for frailty: D → C, March 2026"* is a better headline than anything a press release will give you.

### Per-study attributes captured

Species · design · n · duration · dose and form · outcome measured · funding source · registry ID · replication status · link to primary source. Every one of these is displayed, not summarised away.

## 5. Data model sketch

```
Compound        name, synonyms, forms, typical dose range, UL, safety notes
  └─ Claim      compound + outcome ("creatine → lean mass"), current grade,
                effect size, flags, grade history
       └─ Evidence  link table: claim ↔ study, with the reviewer's note on
                    what this study contributes to this claim
Study           citation, DOI, species, design, n, duration, dose, funding,
                registry ID, primary source URL
Product         brand, compound(s), form, dose per serving, servings,
                price, elemental conversion factor, third-party tested (y/n)
```

`Product` exists only to feed the cost calculator in v1 — no reviews, no ratings, no editorial opinion on brands.

## 6. Pages to design

### 6.1 Home
Job: make a stranger understand the grading system in one screen and reach a compound.

Needs: prominent search, the grading legend as a real, readable element rather than a footnote, a small set of entry points (recently regraded, most searched, biggest gaps between hype and evidence), and the two tools. No hero image of smiling seniors.

### 6.2 Compound register (index)
A dense, scannable table. Filters: evidence grade, claim category (muscle, cognition, metabolic, cardiovascular, sleep, joint), species of best evidence, has safety note. Sort by grade, by recent movement, by number of studies. This should feel like a reference tool, not a shop.

### 6.3 Compound detail — the most important screen
Structure, top to bottom:

1. **Name, forms, what it is** — two sentences, plain language
2. **Claims block** — every claim as a row: outcome, evidence grade, effect size, flags, study count. This is the screen's centrepiece and the thing the design should be built around
3. **Selected claim** — expand a claim to see the studies that produced the grade, as cards showing the per-study attributes, strongest evidence first
4. **Grade timeline** — when the grade moved and what moved it
5. **Dosing and safety** — studied doses vs typical supplement doses, upper limit, who should be careful
6. **Cost snapshot** — cheapest cost per gram of active, linking into the calculator
7. **Last reviewed** date and reviewer, always visible

Design challenge to solve here: the claims block has to communicate two independent scores plus flags per row without turning into a wall of badges.

### 6.4 Cost per gram of active
Input: product name, price, number of servings, dose per serving, compound form. Output: cost per gram of *elemental or active* compound, which is the number people actually can't find. Magnesium is the worked example — magnesium oxide is ~60% elemental magnesium by weight, glycinate around 14%, so the cheap bottle is often the expensive one. Show a comparison list so someone can line up three products they're considering.

Empty state should demonstrate the point rather than ask for input: preload two magnesium products where the cheaper bottle loses.

### 6.5 Stack overlap checker
Input: add products or raw compounds with doses, or paste a list. Output:

- Duplicated compounds across products, with the summed daily dose
- Each total compared against the dose used in studies and against the upper limit where one exists
- Flags for anything over the UL or far under the studied dose
- Total monthly cost, and cost per compound
- A link from each line into the compound's grade — *"you're spending €18/month on something graded D"* is the moment this site earns a bookmark

Persist to a shareable URL, no account needed. Every output carries a plain, non-preachy line that this is not medical advice.

### 6.6 Methodology
The full rubric, the flag definitions, who reviews, how corrections are handled, funding and conflicts of interest. On a health site this page is load-bearing for trust — design it as a real page, not fine print.

## 7. Seed content

Twenty compounds, chosen to span the full grade range so the system visibly discriminates:

Creatine · magnesium (by form) · glycine · NR/NMN · Ca-AKG · TMG · CoQ10 · quercetin · glucosamine · taurine · omega-3 · vitamin D · lion's mane · astaxanthin · hyaluronic acid · L-theanine · glutathione · collagen · berberine · rapamycin (as a "not a supplement" reference entry)

Roughly 3–6 claims each, 4–10 studies per compound. Expect ~2–4 hours of real work per compound. That's the actual project cost — the software is the easy half.

## 8. Voice and copy

Plain, specific, unhurried. States what is known and what isn't, without hedging into mush and without selling. Never uses "boost," "optimize," "unlock," or "supercharge." Grade explanations are written for someone smart who isn't a scientist. Where the honest answer is "nobody has tested this in humans," that sentence appears in full.

## 9. Design direction — constraints, not a look

The visual identity is the design tool's job. These are the constraints it needs to work inside:

- **Reference instrument, not wellness brand.** Nearest neighbours in feel: a field guide, a drug formulary, a materials datasheet. Not a supplement shop, not a clinic, not a Substack.
- **Data density is a feature.** The audience wants to compare things. Tabular numerals, alignable columns, restrained whitespace.
- **The grade system needs a visual language that survives repetition** — it appears in the index, on cards, in the tools, in search results. It must read at a glance and at small size, and must not imply "A = buy this."
- **Species and funding must be legible at a glance.** Consider giving them their own visual channel rather than another badge in the pile.
- **Avoid:** pastel gradients, leaf and DNA-helix motifs, stock photography of active seniors, hero screens with a giant number and a small label, trust badges.
- Accessible by default: colour is never the only carrier of grade meaning; keyboard focus visible; works down to mobile, where the claims block is the hardest problem.

## 10. Build notes

Kotlin/Spring backend with a real relational schema fits this well — the register is genuinely a register, and the grading rubric is a constraint system, not free text. React frontend. Content authored as structured records, not markdown blobs, so the tools and the pages read from the same source. Public read-only JSON API from day one; it costs almost nothing and makes the database citable by others.

## 11. What "it worked" looks like

- Someone searches a compound, reaches the grade, and leaves — and comes back next month for a different compound
- The stack checker produces at least one "I didn't know I was doing that" moment per session
- A regrade event gets shared somewhere without you promoting it
- Newsletter signups come from compound pages, not the home page

## 12. Phase 2 candidates

Book comparisons on points of disagreement · podcast episode digests with claim extraction · NL lab panel comparison · brand comparison on verifiable facts only · the claim ledger of dead hype · saved stacks with accounts · Dutch-language edition.
