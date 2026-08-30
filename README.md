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

> ⚠️ All seed content is marked `reviewer: "draft — unverified"`. Citations, numbers and grades were drafted by an AI assistant and **must be editorially verified against the primary sources before being presented as authoritative**. Product records (`src/content/products/`) are fictional sample data for the cost calculator.

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
- [ ] Replace sample product records with real label data
