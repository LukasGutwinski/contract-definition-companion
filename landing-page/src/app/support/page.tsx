import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileText, LifeBuoy, Mail } from "lucide-react";
import styles from "../imprint/imprint.module.css";

export const metadata: Metadata = {
  title: "Support | Contract Definitions",
  description:
    "Setup, troubleshooting, privacy, and contact information for Contract Definitions for Microsoft Word.",
};

export default function Support() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link className={styles.brand} href="/">
            <span className={styles.brandMark} aria-hidden="true">
              <FileText size={20} strokeWidth={1.8} />
            </span>
            <span>Contract Definitions</span>
          </Link>
          <Link className={styles.backLink} href="/">
            <ArrowLeft aria-hidden="true" size={17} />
            Back to product
          </Link>
        </div>
      </header>

      <section className={styles.legalHero}>
        <div className={styles.heroInner}>
          <p>SUPPORT</p>
          <h1>How can we help?</h1>
          <span>Setup and troubleshooting for Contract Definitions</span>
        </div>
      </section>

      <section className={styles.content}>
        <div className={styles.contentInner}>
          <aside className={styles.companyIntro}>
            <p>CONTACT</p>
            <h2>GUT Ventures GmbH</h2>
            <p className={styles.purpose}>
              Send a synthetic or anonymized example if a definition structure is
              not recognized. Never email confidential contract text.
            </p>
            <a href="mailto:lukas@gut-ventures.com?subject=Contract%20Definitions%20support">
              <Mail aria-hidden="true" size={17} />
              lukas@gut-ventures.com
            </a>
          </aside>

          <div className={styles.bodyCopy}>
            <section>
              <h2>1. Getting started</h2>
              <ol>
                <li>Open an English-language contract in Microsoft Word.</li>
                <li>
                  On the Home ribbon, choose <strong>Definitions</strong> to open
                  the task pane.
                </li>
                <li>
                  Wait for the automatic local scan. Search or select a definition
                  to view it and navigate its occurrences.
                </li>
                <li>
                  Choose <strong>Refresh</strong> after editing the document.
                </li>
              </ol>
            </section>

            <section>
              <h2>2. Requirements</h2>
              <ul>
                <li>Microsoft Word with WordApi 1.6 or later.</li>
                <li>An editable English-language Word document.</li>
                <li>
                  A Microsoft 365 Word version with WordApi 1.7 for temporary inline
                  annotations. The definition list and navigation work without this
                  optional feature.
                </li>
                <li>
                  Network access to load the static add-in files and Microsoft&apos;s
                  required Office.js library.
                </li>
              </ul>
            </section>

            <section>
              <h2>3. No definitions were found</h2>
              <p>
                Contract Definitions recognizes common English definitions-section
                structures. Confirm that the document contains a dedicated
                definitions section and that defined terms use a consistent format.
                Choose <strong>Refresh</strong> after making changes.
              </p>
              <p>
                Deterministic parsing avoids uploading the document but can miss
                unusual or ambiguous drafting. If you report an unsupported pattern,
                send only a synthetic or fully anonymized excerpt.
              </p>
            </section>

            <section>
              <h2>4. Annotations are unavailable</h2>
              <p>
                Inline annotations depend on WordApi 1.7 and a compatible Microsoft
                365 Word client. When this API is not available, Contract Definitions
                hides the annotation controls. Search, pinning, definition display,
                and navigation continue to work.
              </p>
            </section>

            <section>
              <h2>5. The task pane does not load</h2>
              <ul>
                <li>Confirm that Word is online and restart the task pane.</li>
                <li>Close and reopen the document, then try the ribbon command again.</li>
                <li>
                  Ask your Microsoft 365 administrator whether Office add-ins or the
                  add-in&apos;s HTTPS host are blocked by organizational policy.
                </li>
                <li>
                  If the problem continues, email the Word platform, version, and a
                  screenshot of the error without including contract content.
                </li>
              </ul>
            </section>

            <section>
              <h2>6. Privacy and security</h2>
              <p>
                Contract analysis runs in the add-in task pane. Contract text is not
                uploaded to GUT Ventures or sent to an AI provider. Read the full{" "}
                <Link href="/privacy/">Contract Definitions Privacy Policy</Link>.
              </p>
            </section>

            <section>
              <h2>7. Contact support</h2>
              <p>
                Email{" "}
                <a href="mailto:lukas@gut-ventures.com?subject=Contract%20Definitions%20support">
                  lukas@gut-ventures.com
                </a>{" "}
                with the subject “Contract Definitions support”. Include your Word
                platform and version, what you expected, what happened, and the steps
                needed to reproduce it. Do not attach a confidential contract.
              </p>
            </section>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <p>© GUT Ventures GmbH</p>
        <span>
          <LifeBuoy aria-hidden="true" size={15} /> Contract Definitions support
        </span>
      </footer>
    </main>
  );
}
