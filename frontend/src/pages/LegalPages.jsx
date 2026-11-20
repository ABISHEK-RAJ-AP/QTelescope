import React from 'react';
import { Link } from 'react-router-dom';
import { PublicMarketingFooter } from '../components/marketing/PublicMarketingFooter.jsx';

const WRAP = 'mx-auto max-w-3xl px-6 py-14 text-neutral-800 dark:text-neutral-200';

function LegalShell({ title, children }) {
  return (
  <div className="min-h-screen bg-neutral-50 dark:bg-[#070a0f]">
    <header className={`${WRAP} pb-0`}>
      <Link to="/" className="text-sm font-semibold text-cyan-700 dark:text-cyan-400">
        ← Q-TeleScope
      </Link>
      <h1 className="mt-6 text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        Operator and deployment policy for this Q-TeleScope instance.
      </p>
    </header>
    <article className={`${WRAP} prose prose-neutral dark:prose-invert max-w-none text-base leading-relaxed`}>
      {children}
    </article>
    <PublicMarketingFooter compact className="mt-12" />
  </div>
  );
}

export function PrivacyPolicyPage() {
  return (
    <LegalShell title="Privacy Policy">
      <p><strong>Last updated:</strong> November 2026</p>
      <h2>What we collect</h2>
      <p>
        Q-TeleScope stores account data you provide (username, email, organisation name, password hash),
        operator activity in the console, and quantum telemetry ingested from configured backends (device metadata,
        calibration-shaped metrics, job/queue records when adapters supply them).
      </p>
      <h2>What we do not sell</h2>
      <p>We do not sell personal data. Telemetry is used for operations and monitoring inside your deployment.</p>
      <h2>Third parties</h2>
      <p>
        When you configure cloud quantum providers (IBM, Rigetti, IonQ, etc.), their APIs receive only the credentials
        and requests your administrators store in server environment variables — not in the browser bundle.
      </p>
      <h2>Retention</h2>
      <p>Retention follows administrator policy and database backups on your instance. Contact your platform owner for export or deletion.</p>
      <h2>Cookies and local storage</h2>
      <p>
        The console stores session tokens and UI preferences (theme, layout) in your browser. No third-party
        advertising trackers are used in the operator application.
      </p>
      <h2>Contact</h2>
      <p>Use the organisation contact published for your C-DAC or lab deployment.</p>
    </LegalShell>
  );
}

export function TermsPage() {
  return (
    <LegalShell title="Terms of Operation">
      <p><strong>Last updated:</strong> November 2026</p>
      <h2>Operator console</h2>
      <p>
        Q-TeleScope is an internal operations console. Routing and health scores are advisory; they are not vendor SLAs
        or contractual availability guarantees.
      </p>
      <h2>Accounts</h2>
      <p>
        Administrators provision roles. Self-registration may be disabled on production deployments.
        Do not share bootstrap or API credentials.
      </p>
      <h2>Acceptable use</h2>
      <p>
        Use the platform only on systems you are authorised to monitor. Do not attempt to bypass authentication or rate limits.
      </p>
    </LegalShell>
  );
}

export function SecurityNoticePage() {
  return (
    <LegalShell title="Security Notice">
      <p><strong>Last updated:</strong> November 2026</p>
      <ul>
        <li>Send API requests with <code>Authorization: Bearer</code> session tokens; tokens are issued server-side only.</li>
        <li>Provider keys (IBM, IonQ, Rigetti, etc.) belong in server <code>.env</code>, never in frontend source.</li>
        <li>Production deployments should set <code>ENVIRONMENT=production</code>, strong <code>SECRET_KEY</code>, unique bootstrap passwords, and explicit <code>CORS_ORIGINS</code>.</li>
        <li>Report suspected abuse to your platform security contact.</li>
      </ul>
    </LegalShell>
  );
}