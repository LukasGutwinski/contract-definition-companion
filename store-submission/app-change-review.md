# Minimal change review before Marketplace submission

This is a focused publication review, not a general product backlog.

## Must resolve before the first submission

1. **Production URLs in the manifest**
   - Replace every `https://localhost:3002` reference with the final atomic HTTPS release URL.
   - Replace the generic GUT Ventures support and learn-more URLs with product-specific pages.

2. **Public product page cleanup**
   - Replace the generic AppSource link with the actual offer URL when it exists, or hide that call to action until the offer is available.
   - Do not use the older product mockup as a Store screenshot: it shows an older task-pane UI and claims “DE + EN”, while the submitted UI and current scan mode are English.

3. **In-add-in promotional link**
   - Review the menu item `GUT Ventures - Custom Legal Tech solutions` and the promotional copy in the About dialog.
   - The lowest-risk first-release option is to keep publisher attribution, feedback, privacy, and support links but remove the custom-services promotion from the add-in UI. Microsoft applies additional restrictions to upsell-style UI and commerce links on iOS-capable Office add-ins.

4. **Privacy and support links in the add-in**
   - Add direct links to the final Contract Definitions privacy policy and support page in the menu or About/Privacy dialog.
   - Keep the existing in-product disclosure that contract text is processed locally and is not sent to an AI service.

## Already addressed

- The manifest uses Microsoft's current add-in-only XML schema.
- The manifest includes the mandatory high-resolution icon.
- The manifest loads the latest Office.js endpoint from Microsoft's official CDN.
- The manifest now declares WordApi 1.6, matching the minimum API needed by the core implementation.
- Optional WordApi 1.7 annotations are checked at runtime and have a functional fallback.
- The production build, typecheck, and all 34 automated tests currently pass.
- The add-in has no account, SSO, purchase, analytics, AI provider, or application backend.
- The demo contract is fictional and suitable for screenshots and certification testing.
- The temporary color-preview control has been removed from the production landing-page code.
- The public MIT-licensed source repository is available at `https://github.com/LukasGutwinski/contract-definition-companion`.
- Three current, privacy-safe 1280 × 720 PNG Store screenshots have been prepared in `store-submission/assets/`.

## Final functional checks after the app changes

- Test the exact hosted build on Word on the web, Word on Mac, Word on Windows Microsoft 365, and Word on iPad where applicable.
- Verify keyboard-only and touch-only interaction for search, definitions, pinning, navigation, menu, dialogs, refresh, and annotations.
- Verify that no application request contains document text or scan results.
- Verify the final privacy, support, offer, and repository links from inside Word.
- Capture the final screenshots only after these checks, or compare the existing candidates pixel-for-pixel with the final UI.
