# Contract Definition Companion

Local-first Word taskpane add-in for German and English contract definitions.

## What It Does

- Extracts defined terms from English and German contracts with deterministic parser rules.
- Shows definitions in a Word taskpane.
- Supports local persistence via browser/WebView storage.
- Supports an optional inline mode with Word Annotation APIs for temporary underlines and hover/click events.
- Does not send contract text to an application server.

## Local Development

Requires Node `>=20.19.0`.

```bash
npm install
npm run certs
npm run dev
```

The HTTPS dev server is configured for:

```text
https://localhost:3002/
```

The manifest in `manifest.xml` points to the same URL. Sideload the manifest in Word after the dev server is running.

For browser-only demo testing, use HTTP:

```bash
npm run dev:http -- --port 3010
```

## Verification

```bash
npm run typecheck
npm test
npm run build
npm audit
```

## Privacy Model

The parser runs in the Office add-in WebView. Document text is read through Office.js and processed client-side. The app has no backend API, no telemetry, and no analytics. Local persistence, when enabled, uses local browser/WebView storage on the client.

The inline mode depends on Microsoft Word Annotation APIs and therefore on Microsoft 365 support for those APIs. The annotations are temporary and are not persisted in the document.
