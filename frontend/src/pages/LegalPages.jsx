import React from 'react'
import { LegalPageLayout } from '@/components/marketing/LegalPageLayout.jsx'
import { CDAC_HOME_URL } from '@/lib/publicBrand.js'

const DEPLOYMENT_SUBTITLE =
  'Deployment-specific notes for this Q-TeleScope instance. For C-DAC-wide policy, see cdac.in.'

function CdacPolicyFooter() {
  return (
    <p className="text-sm text-neutral-600 dark:text-neutral-400">
      Questions about C-DAC governance or national programmes:{' '}
      <a
        href={CDAC_HOME_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-cyan-700 hover:text-cyan-600 dark:text-cyan-400"
      >
        www.cdac.in
      </a>
      .
    </p>
  )
}

export function PrivacyPolicyPage() {
  return (
    <LegalPageLayout title="Privacy Policy" subtitle={DEPLOYMENT_SUBTITLE}>
      <p>
        <strong>Last updated:</strong> November 2026
      </p>
      <h2>What we collect</h2>
      <p>
        Q-TeleScope stores account data you provide (username, email, organisation name, password hash), operator
        activity in the console, and quantum telemetry ingested from configured backends (device metadata,
        calibration-shaped metrics, job and queue records when adapters supply them).
      </p>
      <h2>What we do not sell</h2>
      <p>We do not sell personal data. Telemetry is used for operations and monitoring inside your deployment.</p>
      <h2>Third parties</h2>
      <p>
        When you configure cloud quantum providers (IBM, Rigetti, IonQ, and others), their APIs receive only the
        credentials and requests your administrators store in server environment variables — not in the browser bundle.
      </p>
      <h2>Retention</h2>
      <p>
        Retention follows administrator policy and database backups on your instance. Contact your platform owner for
        export or deletion.
      </p>
      <h2>Cookies and local storage</h2>
      <p>
        The console stores session tokens and UI preferences (theme, layout) in your browser. No third-party advertising
        trackers are used in the operator application.
      </p>
      <h2>Contact</h2>
      <p>Use the organisation contact published for your C-DAC or lab deployment.</p>
      <CdacPolicyFooter />
    </LegalPageLayout>
  )
}

export function TermsPage() {
  return (
    <LegalPageLayout title="Terms of Operation" subtitle={DEPLOYMENT_SUBTITLE}>
      <p>
        <strong>Last updated:</strong> November 2026
      </p>
      <h2>Operator console</h2>
      <p>
        Q-TeleScope is an internal operations console. Routing and health scores are advisory; they are not vendor SLAs or
        contractual availability guarantees.
      </p>
      <h2>Accounts</h2>
      <p>
        Administrators provision roles. Self-registration may be disabled on production deployments. Do not share bootstrap
        or API credentials.
      </p>
      <h2>Acceptable use</h2>
      <p>
        Use the platform only on systems you are authorised to monitor. Do not attempt to bypass authentication or rate
        limits.
      </p>
      <CdacPolicyFooter />
    </LegalPageLayout>
  )
}

export function SecurityNoticePage() {
  return (
    <LegalPageLayout title="Security Notice" subtitle={DEPLOYMENT_SUBTITLE}>
      <p>
        <strong>Last updated:</strong> November 2026
      </p>
      <ul>
        <li>Send API requests with <code>Authorization: Bearer</code> session tokens; tokens are issued server-side only.</li>
        <li>Provider keys (IBM, IonQ, Rigetti, and others) belong in server <code>.env</code>, never in frontend source.</li>
        <li>
          Production deployments should set <code>ENVIRONMENT=production</code>, strong <code>SECRET_KEY</code>, unique
          bootstrap passwords, and explicit <code>CORS_ORIGINS</code>.
        </li>
        <li>Report suspected abuse to your platform security contact.</li>
      </ul>
      <CdacPolicyFooter />
    </LegalPageLayout>
  )
}