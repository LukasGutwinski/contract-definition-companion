# Initial Marketplace publication review

Contract Definitions completed Microsoft certification and became publicly available as [`WA200011925`](https://marketplace.microsoft.com/en-us/product/WA200011925) on 2 September 2026.

## Resolved for the initial release

- The production manifest uses the stable HTTPS task-pane origin `https://app.contract-definitions.gut-ventures.com/`.
- The immutable Cloudflare Pages release remains available for audit and rollback.
- Product-specific support and privacy URLs are public over HTTPS.
- The manifest declares WordApi 1.6 for the core workflow; WordApi 1.7 annotations are detected at runtime and have a functional fallback.
- The current Marketplace screenshots were captured from the real Word demo using an entirely fictional sample contract.
- The listing, add-in, product website, and source repository use the same product identity and privacy claims.
- The add-in has no Contract Definitions account, SSO, purchase, analytics, AI provider, document upload, or application backend.
- Automated privacy tests verify that document-processing source files do not use Fetch, XHR, WebSockets, EventSource, or beacon APIs.
- The production Content Security Policy uses `connect-src 'none'`.

## Requirements for future updates

- Increment the manifest version while retaining the same add-in ID.
- Keep a hash-addressed build available for rollback.
- Run typecheck, all automated tests, production builds, and dependency audits.
- Smoke-test the exact hosted build in Word on Mac and test other supported Word clients in proportion to the change.
- Re-submit changes that affect the manifest, permissions, material functionality, privacy behavior, or Marketplace claims.
- Update screenshots and certification instructions when visible behavior changes.
