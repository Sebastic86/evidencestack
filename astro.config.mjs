// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';

// Canonical URL — set SITE_URL in the build environment once a domain is chosen.
const site = process.env.SITE_URL || 'https://evidencestack.example.com';

export default defineConfig({
  site,
  output: 'static',
  integrations: [preact(), sitemap()],
});
