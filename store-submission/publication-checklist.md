# Microsoft Marketplace publication checklist

Last reviewed against Microsoft documentation: 28 August 2026.

## Partner Center offer

- [ ] Create Office add-in offer with immutable Offer ID `contract-definitions`.
- [ ] Use internal alias `Contract Definitions`.
- [ ] Confirm the selected publisher is enrolled in the Microsoft 365 and Copilot program.
- [ ] Confirm the publisher name matches manifest `ProviderName`: `GUT Ventures GmbH`.
- [ ] Reserve the Marketplace product name `Contract Definitions` and verify availability.

## Product setup

- [ ] Apple Store/iPad acquisition: decide before saving. Default recommendation for the first release is **No** unless an Apple Developer ID is already configured and iPad acquisition is desired.
- [ ] Microsoft Entra ID or SSO: **No**.
- [ ] Additional purchases: **No**.
- [ ] Lead management CRM: **No**.

## Package and hosting

- [x] XML manifest passes the Microsoft `office-addin-manifest` schema and acceptance validation.
- [x] Manifest now declares the actual minimum core requirement, WordApi 1.6.
- [ ] Deploy the task-pane build to an atomic, hash-addressed HTTPS release URL.
- [ ] Replace every localhost URL in the production manifest.
- [ ] Point `SupportUrl` and `GetStarted.LearnMoreUrl` to product-specific public pages.
- [ ] Increment the manifest version for every submitted update while retaining the same add-in ID.
- [ ] Run production-level Marketplace validation against the final hosted manifest.
- [ ] Verify all production URLs without authentication, redirects, certificate errors, or 404 responses.

## Properties, legal, and support

- [ ] Select one to three accurate categories from the live Partner Center taxonomy.
- [ ] Select at most two industries, or none if no accurate option exists.
- [ ] Use the Microsoft Standard Contract, unless GUT Ventures explicitly chooses a custom EULA. The Standard Contract choice cannot be reversed after publication.
- [ ] Publish a product-specific privacy policy over HTTPS.
- [ ] Publish a product-specific support page over HTTPS.
- [ ] Confirm the privacy page names Contract Definitions and explains personal-data handling rather than only website terms.

## Marketplace listing

- [ ] Use `Contract Definitions`, matching the manifest and product site.
- [ ] Add the English listing first; add another language only after the UI and manifest support it consistently.
- [ ] Paste and preview the summary and HTML description from `listing.en-US.md`.
- [ ] Enter only supported search keywords.
- [ ] Upload the current store logo in the exact dimensions requested by Partner Center.
- [ ] Upload at least one current 1280 × 720 PNG screenshot and caption; up to five are allowed.
- [ ] Remove obsolete images and any personal or confidential information.

## Certification testing

- [ ] Attach or publicly host `demo/Contract-Definitions-Demo-SPA.docx`.
- [ ] Replace every placeholder in `certification-notes.md`.
- [ ] Verify all listed test steps on Word on the web, Word on Mac, Word on Windows Microsoft 365, and Word on iPad where applicable.
- [ ] Verify touch-only use for every feature on supported touch clients.
- [ ] Confirm annotation fallback on a WordApi 1.6 client and annotation behavior on WordApi 1.7.
- [ ] Confirm no application network request contains document content.
- [ ] Confirm accessibility: keyboard navigation, visible focus, accessible names, contrast, zoom, and screen-reader structure.

## Release decisions

- [ ] Availability: default recommendation is publish as soon as certification completes. A scheduled first-publish date cannot be changed after publication.
- [x] The source repository is public at `https://github.com/LukasGutwinski/contract-definition-companion`; keep the URL aligned across the add-in and product site.
- [ ] Obtain final approval from GUT Ventures for the listing, privacy notice, support page, screenshots, and certification notes.
- [ ] Submit for certification only after explicit final approval.

## Expected timing

- Microsoft's validation team generally reviews an Office add-in in 3–5 working days after submission.
- Microsoft advises planning up to four weeks, and its current step-by-step guide says four to six weeks is typical when multiple submissions are required.
- After certification, a product typically appears in Microsoft Marketplace within about one hour.
