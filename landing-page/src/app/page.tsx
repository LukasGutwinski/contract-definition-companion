import Image from "next/image";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Code2,
  Download,
  FileText,
  GitFork,
  Highlighter,
  ListRestart,
  LockKeyhole,
  Menu,
  MousePointerClick,
  Search,
  ShieldCheck,
} from "lucide-react";
import { GutVenturesLogo } from "./GutVenturesLogo";
import { WorkflowVideo } from "./WorkflowVideo";
import styles from "./page.module.css";

const wordStoreUrl =
  process.env.NEXT_PUBLIC_WORD_STORE_URL ?? "https://appsource.microsoft.com/";
const githubUrl =
  process.env.NEXT_PUBLIC_GITHUB_URL ??
  "https://github.com/LukasGutwinski/contract-definition-companion";
const gutVenturesUrl =
  process.env.NEXT_PUBLIC_GUT_VENTURES_URL ?? "https://gut-ventures.com/";
const bookingUrl =
  process.env.NEXT_PUBLIC_BOOKING_URL ??
  "https://calendly.com/gut-ventures/30-minutes-call";

const features = [
  {
    id: "privacy",
    icon: ShieldCheck,
    title: "Private. Local-first.",
    description:
      "Your contracts stay on your device. No document upload, no cloud processing, and no tracking.",
    link: "Read about privacy",
    href: "#privacy-detail",
  },
  {
    id: "context",
    icon: MousePointerClick,
    title: "Definitions in context.",
    description:
      "Click a defined term to see its meaning and move through every occurrence without losing your place.",
    link: "See how it works",
    href: "#how-it-works",
  },
  {
    id: "open-source",
    icon: Code2,
    title: "Open source. Built for trust.",
    description:
      "Inspect the code, verify the processing, and understand exactly what runs inside Word.",
    link: "View on GitHub",
    href: githubUrl,
  },
];

const steps = [
  {
    number: "01",
    icon: Search,
    title: "Scan the contract",
    description:
      "Contract Definitions identifies defined terms and their source clauses directly in the open document.",
  },
  {
    number: "02",
    icon: Highlighter,
    title: "Click any term",
    description:
      "Inline markers make defined terms visible. One click opens the full definition in the Word task pane.",
  },
  {
    number: "03",
    icon: ListRestart,
    title: "Move through occurrences",
    description:
      "Previous and next controls take you to each match while keeping the current definition in view.",
  },
];

function StoreButton({ compact = false }: { compact?: boolean }) {
  return (
    <a
      className={compact ? styles.navCta : styles.primaryCta}
      href={wordStoreUrl}
      target="_blank"
      rel="noreferrer"
    >
      <Download aria-hidden="true" size={compact ? 16 : 19} strokeWidth={1.8} />
      Add to Word
    </a>
  );
}

export default function Home() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brandGroup}>
            <a className={styles.brand} href="#top" aria-label="Contract Definitions home">
              <span className={styles.brandMark} aria-hidden="true">
                <FileText size={20} strokeWidth={1.8} />
              </span>
              <span>Contract Definitions</span>
            </a>
            <a
              className={styles.brandAttribution}
              href={gutVenturesUrl}
              target="_blank"
              rel="noreferrer"
            >
              by GUT Ventures
            </a>
          </div>

          <nav className={styles.desktopNav} aria-label="Primary navigation">
            <a href="#features">Features</a>
            <a href="#privacy-detail">Privacy</a>
            <a href="#open-source-detail">Open source</a>
            <a href="#faq">FAQ</a>
            <StoreButton compact />
          </nav>

          <details className={styles.mobileMenu}>
            <summary aria-label="Open navigation">
              <Menu aria-hidden="true" size={22} />
            </summary>
            <nav aria-label="Mobile navigation">
              <a href="#features">Features</a>
              <a href="#privacy-detail">Privacy</a>
              <a href="#open-source-detail">Open source</a>
              <a href="#gut-ventures">GUT Ventures</a>
              <a href="#faq">FAQ</a>
              <StoreButton compact />
            </nav>
          </details>
        </div>
      </header>

      <section className={styles.hero} id="top">
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>MICROSOFT WORD ADD-IN</p>
            <h1>
              <span>Read the clause.</span>
              <span>Keep the context.</span>
            </h1>
            <p className={styles.heroDescription}>
              Turn defined terms into a searchable index inside Microsoft Word.
              Open a definition and move through its uses without leaving the
              clause you are reviewing.
            </p>
            <div className={styles.heroActions}>
              <StoreButton />
              <a
                className={styles.secondaryCta}
                href={githubUrl}
                target="_blank"
                rel="noreferrer"
              >
                <GitFork aria-hidden="true" size={20} strokeWidth={1.8} />
                View on GitHub
              </a>
            </div>
            <p className={styles.heroPrice}>Free to use. No account required.</p>
            <div className={styles.heroAssurance}>
              <LockKeyhole aria-hidden="true" size={17} strokeWidth={1.8} />
              <span>No server</span>
              <span>No AI</span>
              <span>No document upload</span>
            </div>
          </div>

          <figure className={styles.productVisual}>
            <div className={styles.productCrop}>
              <Image
                className={styles.productImage}
                src="/product/word-product-reference-gut-navy.png"
                alt="Contract Definitions open beside a share purchase agreement in Microsoft Word"
                width={1537}
                height={1023}
                priority
                sizes="(max-width: 800px) 100vw, 68vw"
              />
            </div>
          </figure>
        </div>
      </section>

      <section className={styles.featureBand} id="features" aria-label="Key features">
        <div className={styles.featureGrid}>
          {features.map((feature) => {
            const Icon = feature.icon;
            const external = feature.href.startsWith("http");

            return (
              <article className={styles.feature} key={feature.id} id={feature.id}>
                <span className={styles.featureIcon} aria-hidden="true">
                  <Icon size={26} strokeWidth={1.6} />
                </span>
                <div>
                  <h2>{feature.title}</h2>
                  <p>{feature.description}</p>
                  <a
                    href={feature.href}
                    target={external ? "_blank" : undefined}
                    rel={external ? "noreferrer" : undefined}
                  >
                    {feature.link}
                    <ArrowUpRight aria-hidden="true" size={15} />
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.workflow} id="how-it-works">
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeading}>
            <p className={styles.eyebrow}>BUILT FOR LONG CONTRACTS</p>
            <h2>No more trips back to the definitions section.</h2>
            <p>
              The workflow stays inside Word, so checking a definition never
              breaks your reading flow.
            </p>
          </div>

          <div className={styles.steps}>
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <article className={styles.step} key={step.number}>
                  <div className={styles.stepMeta}>
                    <span>{step.number}</span>
                    <Icon aria-hidden="true" size={23} strokeWidth={1.6} />
                  </div>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </article>
              );
            })}
          </div>

          <figure className={styles.workflowDemo}>
            <figcaption className={styles.workflowDemoCaption}>
              <div>
                <span>SEE IT IN WORD</span>
                <strong>From a defined term to every use.</strong>
              </div>
              <span>16-second walkthrough</span>
            </figcaption>
            <div className={styles.workflowDemoFrame}>
              <WorkflowVideo className={styles.workflowDemoVideo} />
            </div>
          </figure>
        </div>
      </section>

      <section className={styles.privacy} id="privacy-detail">
        <div className={styles.privacyInner}>
          <div className={styles.privacyCopy}>
            <p className={styles.darkEyebrow}>PRIVATE BY DESIGN</p>
            <h2>The contract never leaves Word.</h2>
            <p>
              Detection, indexing, and navigation run on your device. Contract
              text is not sent to our servers because there are no processing
              servers in the product architecture.
            </p>
            <ul>
              <li>
                <Check aria-hidden="true" size={17} /> Client-side processing
              </li>
              <li>
                <Check aria-hidden="true" size={17} /> No account required
              </li>
              <li>
                <Check aria-hidden="true" size={17} /> No document telemetry
              </li>
            </ul>
          </div>

          <div className={styles.localFlow} aria-label="Local processing flow">
            <div>
              <FileText aria-hidden="true" size={25} strokeWidth={1.5} />
              <span>Open document</span>
            </div>
            <ArrowRight aria-hidden="true" size={22} />
            <div>
              <Search aria-hidden="true" size={25} strokeWidth={1.5} />
              <span>Local scan</span>
            </div>
            <ArrowRight aria-hidden="true" size={22} />
            <div>
              <MousePointerClick aria-hidden="true" size={25} strokeWidth={1.5} />
              <span>Definitions in Word</span>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.openSource} id="open-source-detail">
        <div className={styles.openSourceInner}>
          <div className={styles.sectionHeading}>
            <p className={styles.eyebrow}>OPEN SOURCE</p>
            <h2>Trust should be inspectable.</h2>
            <p>
              Review how definitions are detected, how local state is handled,
              and how the add-in interacts with Word.
            </p>
            <a
              className={styles.textLink}
              href={githubUrl}
              target="_blank"
              rel="noreferrer"
            >
              Explore the source on GitHub
              <ArrowUpRight aria-hidden="true" size={17} />
            </a>
          </div>

          <div className={styles.codePanel} aria-label="Source code preview">
            <div className={styles.codeHeader}>
              <span>definition-pattern.ts</span>
              <span>LOCAL</span>
            </div>
            <pre>
              <code>{`const definition = matchDefinition(paragraph);

if (definition) {
  index.add(definition.term, definition.source);
  annotations.markOccurrences(definition.term);
}

// Contract text stays in the Word client.`}</code>
            </pre>
          </div>

          <aside className={styles.selfHosting}>
            <div>
              <p className={styles.eyebrow}>SELF-HOSTING</p>
              <h3>Run it on infrastructure you control.</h3>
            </div>
            <div className={styles.selfHostingCopy}>
              <p>
                The static build can be hosted on any HTTPS origin and deployed
                centrally through Microsoft 365. No application backend,
                database, account system, or API key is required.
              </p>
              <a href={bookingUrl} target="_blank" rel="noreferrer">
                Discuss a team rollout
                <ArrowUpRight aria-hidden="true" size={16} />
              </a>
            </div>
          </aside>
        </div>
      </section>

      <section className={styles.gutVentures} id="gut-ventures">
        <div className={styles.gutVenturesInner}>
          <GutVenturesLogo className={styles.gutSignature} />

          <div className={styles.studioCopy}>
            <p className={styles.eyebrow}>A GUT VENTURES PROJECT</p>
            <h2>Have a legal workflow that deserves a better tool?</h2>
            <p>
              Contract Definitions is built by GUT Ventures, an independent
              legal-tech studio in Vienna. We design focused software for law
              firms and legal teams, from Word add-ins to larger contract
              workflows.
            </p>
          </div>

          <div className={styles.studioActions}>
            <a
              className={styles.studioPrimary}
              href={bookingUrl}
              target="_blank"
              rel="noreferrer"
            >
              Discuss a project
              <ArrowUpRight aria-hidden="true" size={18} />
            </a>
            <a
              className={styles.studioSecondary}
              href={gutVenturesUrl}
              target="_blank"
              rel="noreferrer"
            >
              Explore GUT Ventures
              <ArrowUpRight aria-hidden="true" size={17} />
            </a>
          </div>
        </div>
      </section>

      <section className={styles.faq} id="faq">
        <div className={styles.faqInner}>
          <div className={styles.faqIntro}>
            <p className={styles.eyebrow}>FAQ</p>
            <h2>Before you add it to Word.</h2>
          </div>
          <div className={styles.questions}>
            <details>
              <summary>Is Contract Definitions free to use?</summary>
              <p>
                Yes. The Word add-in is free to use, and its source code is
                available on GitHub.
              </p>
            </details>
            <details>
              <summary>Does the add-in upload contract text?</summary>
              <p>
                No. Contract analysis runs client-side, and the add-in does not
                send document content to a processing server.
              </p>
            </details>
            <details>
              <summary>Does inline mode change the contract text?</summary>
              <p>
                No. Inline markers are visual annotations used by the add-in;
                they do not rewrite the underlying contract language.
              </p>
            </details>
            <details>
              <summary>Can I inspect how it works?</summary>
              <p>
                Yes. The project is open source, including the definition parser
                and the Word integration.
              </p>
            </details>
            <details>
              <summary>Which contracts are supported?</summary>
              <p>
                Contract Definitions is designed for English-language contracts
                and common definitions-section structures. Unusual or ambiguous
                drafting may not be detected correctly.
              </p>
            </details>
          </div>
        </div>
      </section>

      <section className={styles.finalCta} id="get-word">
        <div>
          <p className={styles.darkEyebrow}>CONTRACT DEFINITIONS FOR WORD</p>
          <h2>Read the contract. Keep the context.</h2>
        </div>
        <StoreButton />
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerBrand}>
          <span className={styles.brandMark} aria-hidden="true">
            <FileText size={18} strokeWidth={1.8} />
          </span>
          <span>Contract Definitions</span>
        </div>
        <p>
          An open-source project by{" "}
          <a href={gutVenturesUrl} target="_blank" rel="noreferrer">
            GUT Ventures GmbH
          </a>
          .
        </p>
        <div className={styles.footerLinks}>
          <a href="/support/">Support</a>
          <a href="/privacy/">Privacy</a>
          <a href="/imprint/">Imprint</a>
          <a href={githubUrl} target="_blank" rel="noreferrer">
            GitHub <ArrowUpRight aria-hidden="true" size={14} />
          </a>
          <a href={gutVenturesUrl} target="_blank" rel="noreferrer">
            gut-ventures.com <ArrowUpRight aria-hidden="true" size={14} />
          </a>
        </div>
      </footer>
    </main>
  );
}
