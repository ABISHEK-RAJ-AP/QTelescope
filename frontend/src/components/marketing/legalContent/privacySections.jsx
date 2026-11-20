import React from 'react'
import {
  LEGAL_CONTACT_PLACEHOLDER,
  LEGAL_ORG_NAME,
} from '@/components/marketing/legalDocumentMeta.js'
import { CdacInstitutionLine, LegalList, LegalNote } from './legalContentPrimitives.jsx'

export const PRIVACY_SUBTITLE =
  'How Q-TeleScope handles, processes, stores and protects information associated with platform use on this deployment.'

export const privacySections = [
  {
    id: 'introduction',
    title: '1. Introduction',
    content: (
      <>
        <p>
          This Privacy Policy describes information-handling practices for <strong>Q-TeleScope</strong>, a quantum
          observability console operated as part of a C-DAC quantum technology programme.
        </p>
        <p>
          Q-TeleScope helps authorised operators monitor calibration-shaped telemetry, queues, jobs, alerts, and related
          metadata from configured quantum backends. It is intended for controlled operational environments, not consumer
          marketing use.
        </p>
        <CdacInstitutionLine />
        <LegalNote>
          This page is a deployment baseline for operators. It does not by itself establish compliance with the Digital
          Personal Data Protection Act, 2023 or other regulations — institutional review is required before any
          compliance claim is published.
        </LegalNote>
      </>
    ),
  },
  {
    id: 'scope',
    title: '2. Scope and applicability',
    content: (
      <>
        <p>This policy applies to:</p>
        <LegalList
          items={[
            'Users who authenticate to the Q-TeleScope operator console on this instance.',
            'Administrators who configure backends, alert rules, access controls, and platform settings.',
            'Information processed by the application server and database backing this deployment.',
          ]}
        />
        <p>
          It does not govern third-party quantum cloud providers (IBM Quantum, Rigetti, IonQ, and others). Those providers
          apply their own terms and privacy notices when you connect their APIs using credentials stored server-side.
        </p>
      </>
    ),
  },
  {
    id: 'information-collected',
    title: '3. Categories of information',
    content: (
      <>
        <p>Depending on configuration and role, the platform may process:</p>
        <p>
          <strong>Account information</strong> — username, email address, organisation name (where collected at
          registration), role assignment, password hash (never stored in plain text), optional MFA enrollment metadata
          when TOTP is enabled, and profile fields you choose to update.
        </p>
        <p>
          <strong>Access and session information</strong> — login and logout events, server-issued bearer session tokens,
          session identifiers, optional captcha challenge metadata at login, client IP address when captured in server or
          audit logs, and timestamps associated with authentication.
        </p>
        <p>
          <strong>Operational and telemetry information</strong> — backend identifiers, device and coupling-map metadata,
          calibration and qubit-property snapshots, queue depth and job records when adapters supply them, alert and
          incident records, health scores, and operator notes attached to operational objects.
        </p>
        <p>
          <strong>Audit and administrative information</strong> — administrative actions (user invites, role changes,
          configuration updates, MFA changes), resource identifiers affected, actor username and role where recorded, and
          structured detail payloads written to the audit log.
        </p>
        <p>
          <strong>Technical and diagnostic information</strong> — browser type and UI preference keys in local storage
          (for example theme and layout), optional client vitals or diagnostic hooks where enabled, and API request
          metadata required for troubleshooting.
        </p>
        <LegalNote>Only categories that your deployment actually collects should be treated as in scope. Remove or amend sections that do not apply after institutional review.</LegalNote>
      </>
    ),
  },
  {
    id: 'purposes',
    title: '4. How information is used',
    content: (
      <LegalList
        items={[
          'Authenticating users and enforcing role-based access to console features.',
          'Monitoring quantum backends and presenting observability dashboards, reports, and alerts.',
          'Managing incidents, acknowledgements, and operational workflows.',
          'Recording audit trails for security and accountability.',
          'Supporting administrator configuration of providers, alert rules, and platform settings.',
          'Troubleshooting connectivity, data freshness, and platform defects.',
        ]}
      />
    ),
  },
  {
    id: 'account-auth',
    title: '5. Account and authentication data',
    content: (
      <>
        <p>
          Passwords are verified using a one-way hash on the server. Session continuity uses bearer tokens validated on
          each API request. Optional multi-factor authentication (TOTP) may be enabled per user or policy where
          configured.
        </p>
        <p>
          Login may require a captcha challenge when enabled. Captcha artifacts are short-lived server-side records, not
          long-term profile data.
        </p>
      </>
    ),
  },
  {
    id: 'operational-telemetry',
    title: '6. Operational and quantum backend data',
    content: (
      <>
        <p>
          Telemetry ingested into Q-TeleScope reflects the backends and adapters you connect. It may include calibration
          metrics, queue statistics, job metadata, and derived health indicators. This data supports operations; it is not
          sold or used for third-party advertising.
        </p>
        <p>
          Provider credentials for cloud quantum APIs are intended to reside in server environment configuration (for
          example <code>.env</code> or approved secret stores), not in frontend bundles or browser storage.
        </p>
      </>
    ),
  },
  {
    id: 'audit-diagnostics',
    title: '7. Audit logs and diagnostics',
    content: (
      <>
        <p>
          Security-relevant and administrative events may be appended to an audit log (JSONL file and, when the database
          schema is present, relational audit tables). Events typically include action type, actor, role, resource type,
          resource identifier, timestamp, and optional detail objects.
        </p>
        <p>
          Administrators with appropriate permissions may search or export audit records through the console API. Log
          volume and fields depend on deployment activity.
        </p>
      </>
    ),
  },
  {
    id: 'storage-retention',
    title: '8. Data storage, retention and deletion',
    content: (
      <>
        <p>
          Platform data is stored on infrastructure operated for this deployment (application database, local data
          directories, and configured backups). Retention periods for telemetry, audit events, and accounts are set by
          administrators and institutional policy — they are <strong>not</strong> fixed product-wide SLAs in this
          document.
        </p>
        <p>
          Backup, archival, and deletion procedures follow your platform owner&apos;s runbooks. Contact the designated
          programme owner to request export or deletion of account information where applicable law and policy allow.
        </p>
        <LegalNote>
          Do not state specific retention days (for example CERT-In 180-day log retention) unless your authorised C-DAC
          team has confirmed they apply to this deployment.
        </LegalNote>
      </>
    ),
  },
  {
    id: 'sharing',
    title: '9. Information sharing and disclosure',
    content: (
      <LegalList
        items={[
          'Authorised operators and administrators within your organisation, limited by role.',
          'Infrastructure or hosting personnel who maintain this instance under contract and need access for operations.',
          'Quantum cloud providers, only to the extent your administrators direct API calls using stored credentials.',
          'Disclosure required under applicable law or authorised government direction, when legally compelled.',
        ]}
      />
    ),
  },
  {
    id: 'security-safeguards',
    title: '10. Security safeguards',
    content: (
      <>
        <p>Controls implemented in Q-TeleScope include, where enabled on this instance:</p>
        <LegalList
          items={[
            'Role-based access control with capability checks on API routes.',
            'Server-side session validation for authenticated requests.',
            'Optional MFA (TOTP) for user accounts.',
            'Administrative audit logging for security-relevant actions.',
            'Separation of provider secrets from client-side code paths.',
          ]}
        />
        <LegalNote>
          Transport security (HTTPS/TLS), encryption at rest, penetration testing cadence, and certification status must
          be described only if verified for your hosting environment — they are not asserted here.
        </LegalNote>
      </>
    ),
  },
  {
    id: 'cookies-sessions',
    title: '11. Cookies and browser storage',
    content: (
      <>
        <p>
          The operator console stores a session token and minimal user profile JSON in <code>localStorage</code> (for
          example <code>quantum_user</code>) to maintain signed-in state. Theme and layout preferences may be stored under
          theme-related keys. A post-login redirect path may be held briefly in <code>sessionStorage</code>.
        </p>
        <p>
          Q-TeleScope does not use third-party advertising trackers in the operator application. Public login pages may use
          short-lived captcha challenges validated server-side.
        </p>
      </>
    ),
  },
  {
    id: 'user-rights',
    title: '12. User rights and responsibilities',
    content: (
      <LegalList
        items={[
          'Request correction of account profile fields through administrators or self-service where available.',
          'Report suspected unauthorised access to your platform security contact.',
          'Protect credentials, MFA devices, and session-bearing workstations.',
          'Use only roles and data scopes assigned to you.',
        ]}
      />
    ),
  },
  {
    id: 'policy-updates',
    title: '13. Policy updates',
    content: (
      <p>
        Revisions will be published on this site with an updated &quot;Last reviewed&quot; date and version number when
        approved. Material changes should be communicated through your institutional channel for operator notices.
      </p>
    ),
  },
  {
    id: 'contact',
    title: '14. Contact and grievance',
    content: (
      <>
        <p>
          <strong>Responsible organisation:</strong> {LEGAL_ORG_NAME}
        </p>
        <p>
          <strong>Deployment contact:</strong> {LEGAL_CONTACT_PLACEHOLDER}
        </p>
        <p>
          For programme-level grievances, follow the official channel published by C-DAC on{' '}
          <a href="https://www.cdac.in/" target="_blank" rel="noopener noreferrer">
            cdac.in
          </a>{' '}
          once designated.
        </p>
      </>
    ),
  },
]