# Contract Definitions product website

This directory contains the public product, support, privacy, and imprint pages for Contract Definitions:

- `https://contract-definitions.gut-ventures.com/`
- `https://contract-definitions.gut-ventures.com/support/`
- `https://contract-definitions.gut-ventures.com/privacy/`
- `https://contract-definitions.gut-ventures.com/imprint/`

The site is a statically exported Next.js application hosted on Cloudflare Pages. It has no application backend, analytics, advertising, or contact-form processing.

## Local development

Use Node.js 22 or later:

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`.

## Verification

```bash
npm run lint
npm run build
npm audit
```

The static export is written to `out/`.

## Deployment

The Cloudflare Pages configuration is stored in `wrangler.jsonc`. Deploy the verified static export with:

```bash
npm run deploy
```

The production Marketplace URL is the default in `src/app/page.tsx`. It can be overridden at build time with `NEXT_PUBLIC_WORD_STORE_URL` when testing a preview.

Before deploying a privacy-policy change, confirm that the published text still matches the add-in, Microsoft Marketplace, Cloudflare, and support-email data flows.
