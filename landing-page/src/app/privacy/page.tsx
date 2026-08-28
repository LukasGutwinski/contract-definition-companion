import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, FileText, Mail, ShieldCheck } from "lucide-react";
import styles from "../imprint/imprint.module.css";

export const metadata: Metadata = {
  title: "Privacy Policy | Contract Definitions",
  description:
    "Privacy information for the Contract Definitions add-in for Microsoft Word.",
};

const cloudflareDpaUrl =
  "https://www.cloudflare.com/en-gb/cloudflare-customer-dpa/";

export default function PrivacyPolicy() {
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
          <p>PRIVACY</p>
          <h1>Privacy Policy</h1>
          <span>How Contract Definitions handles data</span>
        </div>
      </section>

      <section className={styles.content}>
        <div className={styles.contentInner}>
          <aside className={styles.companyIntro}>
            <p>DATA CONTROLLER</p>
            <h2>GUT Ventures GmbH</h2>
            <address>
              Meiereistraße 14/158
              <br />
              1020 Vienna
              <br />
              Austria
            </address>
            <a href="mailto:lukas@gut-ventures.com?subject=Contract%20Definitions%20privacy">
              <Mail aria-hidden="true" size={17} />
              lukas@gut-ventures.com
            </a>
          </aside>

          <div className={styles.bodyCopy}>
            <section>
              <h2>1. Scope and privacy by design</h2>
              <p>
                This policy applies to <strong>Contract Definitions</strong>, a
                Microsoft Word add-in provided by GUT Ventures GmbH. Contract
                Definitions reads the open document through Microsoft&apos;s Office
                JavaScript API and analyzes defined terms inside the add-in task
                pane.
              </p>
              <p className={styles.notice}>
                Contract text and scan results are not uploaded to GUT Ventures,
                sent to an AI provider, used for analytics, or stored by an
                application backend.
              </p>
            </section>

            <section>
              <h2>2. Document content and scan results</h2>
              <p>
                Contract text is accessed only to detect definitions, display them
                in the task pane, navigate to their locations, and optionally add
                temporary Word annotations. Processing takes place in the add-in
                WebView. Contract text and scan results remain in memory while the
                task pane is open and are not written to browser storage by the
                current version of the add-in.
              </p>
              <p>
                The add-in does not create an account, build a user profile, or
                collect document names, document identifiers, user identifiers, or
                usage events for GUT Ventures.
              </p>
            </section>

            <section>
              <h2>3. Local preferences</h2>
              <p>
                Contract Definitions uses local browser or WebView storage only for
                non-document preferences, such as the annotation mode and a settings
                version. These preferences remain in the Office add-in environment
                on the user&apos;s device and are not transmitted to GUT Ventures. The
                add-in remains usable if local storage is blocked; preferences may
                then reset between sessions.
              </p>
            </section>

            <section>
              <h2>4. Delivery of static application files</h2>
              <p>
                The add-in is delivered as static HTML, JavaScript, CSS, and image
                files. We currently plan to use Cloudflare Pages as the hosting and
                content-delivery provider. When Word retrieves these files,
                Cloudflare may process technical connection data such as the IP
                address, time of request, requested file, user agent, and security
                information needed to deliver and protect the service.
              </p>
              <p>
                This processing is based on our legitimate interests in providing a
                secure, reliable, and abuse-resistant add-in under Article 6(1)(f)
                GDPR. GUT Ventures does not use Pages Functions, Cloudflare Web
                Analytics, advertising cookies, or application telemetry for
                Contract Definitions. We do not maintain a separate application log
                of document use. Technical data is retained according to the
                provider&apos;s service configuration and only for as long as necessary
                for delivery, security, and legal obligations.
              </p>
              <p>
                Cloudflare acts as a processor for service delivery and may process
                data outside the European Economic Area subject to applicable data
                transfer safeguards. Further details are available in the{" "}
                <a href={cloudflareDpaUrl} target="_blank" rel="noreferrer">
                  Cloudflare Data Processing Addendum
                  <ArrowUpRight aria-hidden="true" size={14} />
                </a>
                . This section will be updated before publication if a different
                hosting provider is selected.
              </p>
            </section>

            <section>
              <h2>5. Microsoft Word and Office.js</h2>
              <p>
                Contract Definitions runs within Microsoft Word and loads Office.js
                from Microsoft&apos;s official content-delivery network, as required for
                Office add-ins. Microsoft&apos;s processing in Microsoft 365, Word, and
                Office.js is governed by the agreements and privacy information
                applicable to the user&apos;s Microsoft account or organization. GUT
                Ventures does not receive Microsoft account credentials.
              </p>
            </section>

            <section>
              <h2>6. Support communications</h2>
              <p>
                If you contact us by email, we process the contact details and
                message content you choose to provide in order to answer your
                request. The legal basis is Article 6(1)(b) GDPR where the request
                concerns a service relationship and otherwise Article 6(1)(f) GDPR,
                based on our legitimate interest in providing support. Do not send
                confidential contract text; use a synthetic or anonymized example.
              </p>
            </section>

            <section>
              <h2>7. Your rights</h2>
              <p>
                Subject to the conditions of applicable law, you may request access,
                rectification, erasure, restriction, portability, or object to
                processing based on legitimate interests. You may also lodge a
                complaint with a competent data protection authority. In Austria,
                this is the Austrian Data Protection Authority.
              </p>
              <p>
                Because Contract Definitions does not transmit document content or
                local preferences to GUT Ventures, we generally cannot identify or
                retrieve that local data.
              </p>
            </section>

            <section>
              <h2>8. Changes and contact</h2>
              <p>
                We will update this policy if the add-in&apos;s data flows, hosting, or
                legal requirements change. Material changes will be reflected on
                this page. Questions and privacy requests can be sent to{" "}
                <a href="mailto:lukas@gut-ventures.com?subject=Contract%20Definitions%20privacy">
                  lukas@gut-ventures.com
                </a>
                .
              </p>
              <p>Draft date: 28 August 2026.</p>
            </section>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <p>© GUT Ventures GmbH</p>
        <span>
          <ShieldCheck aria-hidden="true" size={15} /> Privacy by design
        </span>
      </footer>
    </main>
  );
}
