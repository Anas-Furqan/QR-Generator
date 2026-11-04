import { defineConfig } from 'vite';

/*
 * Link previews on WhatsApp and LinkedIn need a FULL url for og:image
 * (https://.../og-image.png), not just "/og-image.png". index.html uses the
 * placeholder __SITE_URL__, which we fill in at build time:
 *   - SITE_URL, if you set it (e.g. for a custom domain), otherwise
 *   - VERCEL_PROJECT_PRODUCTION_URL, which Vercel sets automatically, otherwise
 *   - nothing (relative links; fine for local development).
 * Vercel still auto-detects Vite, so deployment stays zero-config.
 */
function siteUrl() {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return '';
}

export default defineConfig({
  plugins: [
    {
      name: 'site-url',
      transformIndexHtml: (html) => html.replaceAll('__SITE_URL__', siteUrl()),
    },
  ],
});
