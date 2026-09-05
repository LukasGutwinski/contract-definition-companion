import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, FileText, Mail } from "lucide-react";
import styles from "./imprint.module.css";

export const metadata: Metadata = {
  title: "Imprint | Contract Definitions",
  description: "Legal notice and company information for Contract Definitions.",
};

const gutVenturesUrl = "https://gut-ventures.com/";
const bookingUrl = "https://calendly.com/gut-ventures/30-minutes-call";
const tradeLawUrl =
  "https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10007517";
const supervisoryAuthorityUrl =
  "https://www.wien.gv.at/kontakt/magistratische-bezirksaemter";
const chamberUrl =
  "https://www.wko.at/wien/information-consulting/unternehmensberatung-buchhaltung-informationstechnologie/start";

export default function Imprint() {
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
          <p>LEGAL</p>
          <h1>Legal Notice</h1>
          <span>Company information for Contract Definitions</span>
        </div>
      </section>

      <section className={styles.content}>
        <div className={styles.contentInner}>
          <aside className={styles.companyIntro}>
            <p>RESPONSIBLE ENTITY</p>
            <h2>GUT Ventures GmbH</h2>
            <address>
              Meiereistraße 14/158
              <br />
              1020 Wien
              <br />
              Austria
            </address>
            <a href="mailto:lukas@gut-ventures.com">
              <Mail aria-hidden="true" size={17} />
              lukas@gut-ventures.com
            </a>
            <a href={bookingUrl} target="_blank" rel="noreferrer">
              <ArrowUpRight aria-hidden="true" size={17} />
              Online contact and appointments
            </a>
          </aside>

          <div className={styles.legalDetails}>
            <section>
              <p className={styles.sectionNumber}>01</p>
              <div>
                <h2>Company details</h2>
                <dl>
                  <div>
                    <dt>Provider and media owner</dt>
                    <dd>GUT Ventures GmbH</dd>
                  </div>
                  <div>
                    <dt>Legal form</dt>
                    <dd>Gesellschaft mit beschränkter Haftung (GmbH)</dd>
                  </div>
                  <div>
                    <dt>Registered office</dt>
                    <dd>Vienna, Austria</dd>
                  </div>
                  <div>
                    <dt>Authorised representative</dt>
                    <dd>Lukas Gutwinski MSc (WU)</dd>
                  </div>
                </dl>
              </div>
            </section>

            <section>
              <p className={styles.sectionNumber}>02</p>
              <div>
                <h2>Registration</h2>
                <dl>
                  <div>
                    <dt>Company register number</dt>
                    <dd>607397g</dd>
                  </div>
                  <div>
                    <dt>Register court</dt>
                    <dd>Commercial Court of Vienna</dd>
                  </div>
                  <div>
                    <dt>VAT identification number</dt>
                    <dd>ATU 79614703</dd>
                  </div>
                </dl>
              </div>
            </section>

            <section>
              <p className={styles.sectionNumber}>03</p>
              <div>
                <h2>Business and professional information</h2>
                <dl>
                  <div>
                    <dt>Business purpose and trade</dt>
                    <dd>
                      Services in automatic data processing and information
                      technology
                    </dd>
                  </div>
                  <div>
                    <dt>Professional designation</dt>
                    <dd>IT service provider</dd>
                  </div>
                  <div>
                    <dt>Member state</dt>
                    <dd>Austria</dd>
                  </div>
                  <div>
                    <dt>GISA number</dt>
                    <dd>36190508</dd>
                  </div>
                </dl>
              </div>
            </section>

            <section>
              <p className={styles.sectionNumber}>04</p>
              <div>
                <h2>Chamber, authority, and applicable law</h2>
                <dl>
                  <div>
                    <dt>Chamber membership</dt>
                    <dd>
                      <a href={chamberUrl} target="_blank" rel="noreferrer">
                        Vienna Economic Chamber, Professional Group for Management
                        Consulting, Accounting and Information Technology
                      </a>
                    </dd>
                  </div>
                  <div>
                    <dt>Supervisory authority</dt>
                    <dd>
                      <a
                        href={supervisoryAuthorityUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Magistratisches Bezirksamt des II. Bezirkes, City of
                        Vienna
                      </a>
                    </dd>
                  </div>
                  <div>
                    <dt>Applicable professional law</dt>
                    <dd>
                      <a href={tradeLawUrl} target="_blank" rel="noreferrer">
                        Austrian Trade Regulation Act 1994 (Gewerbeordnung 1994)
                      </a>
                    </dd>
                  </div>
                </dl>
              </div>
            </section>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <p>© GUT Ventures GmbH</p>
        <a href={gutVenturesUrl} target="_blank" rel="noreferrer">
          gut-ventures.com
          <ArrowUpRight aria-hidden="true" size={15} />
        </a>
      </footer>
    </main>
  );
}
