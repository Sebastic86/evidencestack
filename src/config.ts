export const SITE_NAME = 'Evidence Stack';
export const TAGLINE = 'The supplement evidence register';

/**
 * Buttondown newsletter account username. Create the account at buttondown.com
 * and put the username here; the footer form posts to their embed endpoint.
 */
export const BUTTONDOWN_USERNAME = 'evidencestack';

/**
 * PLACEHOLDER — no contact address has been chosen yet. MUST be set before the
 * next deploy. The footer, /about, /privacy and the corrections section of
 * /methodology all read from this one constant; while it is empty they say the
 * address is not yet published, which is true. Never put a stand-in address
 * here — an unpublished address is honest, an invented one is not.
 */
export const CONTACT_EMAIL = '';

/**
 * Beta: keep the site out of search results.
 *
 * Set to false to launch. That single change removes the robots meta tag from
 * every page — but it is NOT the whole switch: `nginx.conf` also sends an
 * `X-Robots-Tag: noindex` header, and `public/robots.txt` withholds the
 * sitemap. All three have to change together. See TODO.md, "Before launch".
 *
 * Why a noindex tag rather than `Disallow: /` in robots.txt: robots.txt
 * controls crawling, not indexing. A disallowed URL can still be listed in
 * results from third-party links, and — the trap — a crawler that is blocked
 * never fetches the page, so it never sees this tag and the URL stays indexed.
 * Crawling must be allowed for the noindex to be read and obeyed.
 */
export const NOINDEX = true;

export const DISCLAIMER =
  'Evidence Stack summarises published research. It is not medical advice, and a grade is not a recommendation.';
