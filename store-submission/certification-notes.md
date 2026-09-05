# Notes for Microsoft certification

Status: Published release record. Microsoft certification completed on 2 September 2026 and the offer is live as `WA200011925`.

## Access and dependencies

- No test account, credentials, license key, tenant configuration, subscription, or external purchase is required.
- The add-in does not use Microsoft Entra ID or single sign-on.
- The add-in has no application backend, AI service, analytics service, or document upload endpoint.
- Internet access is needed only to load the static add-in files from `https://app.contract-definitions.gut-ventures.com/` and Office.js from Microsoft's official CDN.
- The custom production URL currently serves the same tested build as the immutable Cloudflare Pages deployment `https://f4f1217a.contract-definition-companion-app.pages.dev/`. The immutable URL is retained for audit and rollback purposes.

## Sample document

Use the attached synthetic document `Contract-Definitions-Demo-SPA.docx`. It contains no real persons, companies, addresses, transaction data, or commercial terms and is expressly prepared for Marketplace certification and screenshots.

If Partner Center does not support attaching the document, download it from `https://contract-definitions.gut-ventures.com/demo/Contract-Definitions-Demo-SPA.docx`.

## Test steps

1. Open `Contract-Definitions-Demo-SPA.docx` in Microsoft Word.
2. On the Home ribbon, choose **Definitions** and then **Definitions** to open the Contract Definitions task pane.
3. Wait for the automatic local scan to finish. A searchable list of defined terms should appear.
4. Search for **Purchase Price**. Select the result to display its definition and detected uses.
5. Use the previous and next occurrence controls. Word should select successive occurrences in the document without changing the contract text.
6. Clear the search and pin one or more definitions. Pinned terms should remain at the top of the list while the task pane is open.
7. Edit a harmless word in the demo document and choose **Refresh**. The index should be recalculated from the open document.
8. On a Microsoft 365 Word client that supports WordApi 1.7, choose **Annotate all defined terms**. Temporary inline annotations should appear. Choose **Remove annotations** to remove them.
9. Open **Menu → Privacy**. The add-in should explain that contract text is processed locally and is not uploaded to an application server or AI service.

## Expected fallback behavior

- On a WordApi 1.6 client without WordApi 1.7, definition detection, search, pinning, and navigation remain available; annotation controls are not shown.
- If the document has no recognizable English definitions section, the add-in displays **No definitions found** and offers a refresh action.
- If browser storage is unavailable, the add-in continues to work; only non-document preferences are not persisted.

## Permission justification

The add-in requests `ReadWriteDocument` because it must read paragraph text, select the source paragraph and detected occurrences, and optionally insert or remove temporary Word annotations. Contract text and scan results remain in the task-pane memory and are not transmitted to GUT Ventures or another application backend. The add-in does not rewrite the underlying contract language.

## Network and privacy behavior

- Contract parsing is deterministic and runs in the add-in WebView.
- No contract text, scan result, document identifier, user identifier, or usage event is sent to GUT Ventures.
- No telemetry, advertising, cookies, or application analytics are used.
- Local storage contains only non-document preferences such as annotation mode and a settings version.
- The production Content Security Policy uses `connect-src 'none'` to block application network connections, including connections to the add-in's own origin. Office.js is loaded as a script from `https://appsforoffice.microsoft.com/lib/1/hosted/office.js` as required by Microsoft.

## Support

- Product page: `https://contract-definitions.gut-ventures.com/`
- Support page: `https://contract-definitions.gut-ventures.com/support/`
- Privacy policy: `https://contract-definitions.gut-ventures.com/privacy/`
- Support email: `lukas@gut-ventures.com`
