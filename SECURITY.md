# Security policy

## Supported version

Security fixes are provided for the latest version of Contract Definitions available through [Microsoft Marketplace](https://marketplace.microsoft.com/en-us/product/WA200011925).

## Reporting a vulnerability

Please report suspected vulnerabilities privately by emailing [lukas@gut-ventures.com](mailto:lukas@gut-ventures.com?subject=Contract%20Definitions%20security). Do not open a public issue for a vulnerability before a fix is available.

Include the affected version, Word platform, reproduction steps, and expected impact. Never attach a confidential contract; use a synthetic or fully anonymized example if document structure is relevant.

GUT Ventures will acknowledge reports as soon as reasonably possible and coordinate disclosure and remediation with the reporter. This project does not currently operate a paid bug-bounty program.

## Security model

Contract Definitions processes document text inside the Word add-in WebView. The published build has no application backend, analytics, advertising, or AI service. Its Content Security Policy blocks application network connections with `connect-src 'none'`; Office.js is loaded from Microsoft's official CDN.
