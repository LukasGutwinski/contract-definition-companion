# Microsoft Marketplace publication checklist

Published: 2 September 2026. Last reconciled with the live Partner Center and Marketplace records: 5 September 2026.

Public listing: `https://marketplace.microsoft.com/en-us/product/WA200011925`

Unchecked compatibility items below are follow-up regression checks for future releases; they no longer indicate that the initial submission is pending.

## Partner Center offer

- [x] Create Office add-in offer with immutable Offer ID `contract-definitions`.
- [x] Use internal alias `Contract Definitions`.
- [x] Confirm the selected publisher is enrolled in the Microsoft 365 and Copilot program.
- [x] Confirm the publisher name matches manifest `ProviderName`: `GUT Ventures GmbH`.
- [x] Reserve the Marketplace product name `Contract Definitions` and verify availability.

## Product setup

- [x] Apple Store/iPad acquisition: **No** for the first release. This does not affect support for Word on macOS.
- [x] Microsoft Entra ID or SSO: **No**.
- [x] Additional purchases: **No**.
- [x] Lead management CRM: **No**. Marketplace may still expose acquisition leads in Partner Center; the privacy policy addresses this separately.

## Package and hosting

- [x] XML manifest passes the Microsoft `office-addin-manifest` schema and acceptance validation.
- [x] Manifest now declares the actual minimum core requirement, WordApi 1.6.
- [x] Deploy the task-pane build to the stable HTTPS production URL; retain the atomic, hash-addressed release URL for audit and rollback.
- [x] Replace every localhost URL in the production manifest.
- [x] Point `SupportUrl` and `GetStarted.LearnMoreUrl` to product-specific public pages.
- [ ] Increment the manifest version for every submitted update while retaining the same add-in ID.
- [x] Run production-level Marketplace validation against the final hosted manifest.
- [x] Verify all production URLs without authentication, certificate errors, or 404 responses; expected Cloudflare canonical redirects are acceptable.

## Properties, legal, and support

- [x] Complete the required category selection in Partner Center.
- [x] Complete or intentionally omit optional industry selections in Partner Center.
- [x] Use the Microsoft Standard Contract.
- [x] Publish a product-specific privacy policy over HTTPS.
- [x] Publish a product-specific support page over HTTPS.
- [x] Confirm the privacy page names Contract Definitions and explains personal-data handling rather than only website terms.

## Marketplace listing

- [x] Use `Contract Definitions`, matching the manifest and product site.
- [x] Publish the English listing first; add another language only after the UI and manifest support it consistently.
- [x] Paste and preview the summary and HTML description from `listing.en-US.md`.
- [x] Enter only supported search keywords.
- [x] Upload the current store logo in the dimensions requested by Partner Center.
- [x] Upload three current 1366 × 768 PNG screenshots and captions.
- [x] Remove obsolete images and any personal or confidential information.

## Certification testing

- [x] Attach or publicly host `demo/Contract-Definitions-Demo-SPA.docx`.
- [x] Replace every placeholder in `certification-notes.md`.
- [x] Smoke-test the stable production build in Word on Mac.
- [x] Complete Microsoft Marketplace certification.
- [ ] Verify all listed test steps on Word on the web, Word on Mac, and Word on Windows Microsoft 365.
- [ ] Perform a basic compatibility check on Word on iPad even though direct iPad acquisition is disabled: WordApi 1.6 is available on iPad, and Marketplace add-in manifests don't cleanly exclude iPad while retaining Mac and web support.
- [ ] Verify touch-only use for every feature on supported touch clients.
- [ ] Confirm annotation fallback on a WordApi 1.6 client and annotation behavior on WordApi 1.7.
- [ ] Confirm no application network request contains document content.
- [ ] Confirm accessibility: keyboard navigation, visible focus, accessible names, contrast, zoom, and screen-reader structure.

## Release decisions

- [x] Publish as soon as certification completes.
- [x] The source repository is public at `https://github.com/LukasGutwinski/contract-definition-companion`; keep the URL aligned across the add-in and product site.
- [x] Obtain final approval from GUT Ventures for the listing, privacy notice, support page, screenshots, and certification notes.
- [x] Submit for certification after explicit final approval.

## Actual initial publication timing

- Submitted: 28 August 2026.
- Certification completed: 2 September 2026 at 07:24 UTC.
- Publishing completed: 2 September 2026 at 07:29 UTC.
