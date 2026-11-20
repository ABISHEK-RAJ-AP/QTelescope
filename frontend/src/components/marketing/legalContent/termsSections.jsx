import React from 'react'
import { LEGAL_CONTACT_PLACEHOLDER, LEGAL_ORG_NAME } from '@/components/marketing/legalDocumentMeta.js'
import { CdacInstitutionLine, LegalList, LegalNote } from './legalContentPrimitives.jsx'

export const TERMS_SUBTITLE =
  'Rules, responsibilities and conditions governing access to and use of the Q-TeleScope platform on this deployment.'

export const termsSections = [
  {
    id: 'acceptance',
    title: '1. Acceptance and applicability',
    content: (
      <>
        <p>
          By accessing Q-TeleScope you agree to operate within these Terms of Operation and applicable institutional policies
          of {LEGAL_ORG_NAME}. Access is limited to authorised users provisioned by administrators.
        </p>
        <CdacInstitutionLine />
      </>
    ),
  },
  {
    id: 'platform-overview',
    title: '2. Platform overview',
    content: (
      <p>
        Q-TeleScope is a quantum observability platform for monitoring, analysing and managing quantum computing resources
        across connected backends. It provides telemetry views, alerts, incidents, reports, and configuration tools — not
        direct execution of customer quantum workloads except where integrated adapters expose job or queue metadata.
      </p>
    ),
  },
  {
    id: 'eligibility',
    title: '3. Eligibility and authorised access',
    content: (
      <>
        <p>
          Accounts are created through administrator invitation, approved self-registration (when enabled), or bootstrap
          provisioning on first deploy. You must use accurate organisational information where requested and maintain
          current contact details through your administrator.
        </p>
        <p>Sharing credentials, API tokens, or session-bearing browser profiles is prohibited.</p>
      </>
    ),
  },
  {
    id: 'roles',
    title: '4. User roles and permissions',
    content: (
      <>
        <p>This implementation supports role-based access. Examples include:</p>
        <LegalList
          items={[
            'Platform administrator (PlatformAdmin / Admin) — full platform scope across organisations.',
            'Organisation administrator (OrgAdmin) — member and role management within an organisation.',
            'Security administrator (SecurityAdmin) — users, MFA, sessions, and security-related audit exports.',
            'Quantum operations administrator (QuantumOpsAdmin) — fleet configuration, providers, alert rules, platform settings.',
            'Operations engineer (Operator / OpsEngineer) — monitor fleet, alerts, and incidents.',
            'Incident commander — extended incident response including assignment and closure.',
            'Research analyst (ResearchAnalyst / Researcher) — read-focused access with reporting and studio features where permitted.',
            'Viewer — read-only observability and reports.',
            'Auditor — emphasis on reports and audit visibility where configured.',
          ]}
        />
        <LegalNote>Effective permissions follow the capability matrix enforced by the API. If your deployment disables a role, treat that role as unavailable.</LegalNote>
      </>
    ),
  },
  {
    id: 'acceptable-use',
    title: '5. Acceptable use',
    content: (
      <LegalList
        items={[
          'Use the platform only for authorised operational, research-support, or administrative purposes.',
          'Access backends and telemetry scopes assigned to your role.',
          'Follow institutional security, export-control, and acceptable-use policies.',
          'Report suspected misuse or data integrity issues promptly.',
          'Use monitoring and administrative features responsibly — advisory scores are not vendor SLAs.',
        ]}
      />
    ),
  },
  {
    id: 'prohibited',
    title: '6. Prohibited activities',
    content: (
      <LegalList
        items={[
          'Attempting unauthorised access, privilege escalation, or bypass of RBAC checks.',
          'Circumventing authentication, captcha, MFA, or rate limits.',
          'Altering, deleting, or falsifying audit or telemetry records without authorisation.',
          'Disrupting connected backends through abusive polling or unapproved automation.',
          'Introducing malware or unauthorised code into the deployment environment.',
          'Misusing administrative credentials or provider secrets.',
        ]}
      />
    ),
  },
  {
    id: 'responsibilities',
    title: '7. Operational responsibilities',
    content: (
      <LegalList
        items={[
          'Registering and de-registering backends with accurate metadata.',
          'Reviewing alerts, incidents, and calibration drift indicators.',
          'Maintaining provider credentials in approved server-side configuration.',
          'Escalating unresolved operational or security issues.',
          'Coordinating planned configuration changes through change-management practice.',
        ]}
      />
    ),
  },
  {
    id: 'third-party',
    title: '8. Third-party backend integrations',
    content: (
      <>
        <p>Connected quantum services remain subject to their own:</p>
        <LegalList
          items={[
            'Provider terms of use and privacy notices.',
            'Service availability, maintenance windows, and fair-use limits.',
            'Authentication and credential rotation requirements.',
            'Export-control or geography restrictions on API access.',
          ]}
        />
        <p>Q-TeleScope surfaces status and metadata; it does not replace provider contracts.</p>
      </>
    ),
  },
  {
    id: 'availability',
    title: '9. Service availability and maintenance',
    content: (
      <>
        <p>
          Planned maintenance, unexpected outages, backend API errors, synchronisation delays, and replay or cache staleness
          may affect dashboards. Recovery follows administrator runbooks for this deployment.
        </p>
        <LegalNote>No guaranteed uptime or disaster-recovery SLA is stated here unless approved by C-DAC for your environment.</LegalNote>
      </>
    ),
  },
  {
    id: 'limitations',
    title: '10. Limitation of responsibility',
    content: (
      <>
        <p>
          Monitoring information, health scores, routing suggestions, and analytics are <strong>advisory</strong>. They do
          not guarantee quantum hardware performance, error rates, queue times, or computational outcomes.
        </p>
        <p>
          Liability limitations and indemnities for government deployments must be reviewed and approved by authorised
          C-DAC legal counsel before publication in a binding form.
        </p>
      </>
    ),
  },
  {
    id: 'suspension',
    title: '11. Suspension and termination',
    content: (
      <p>
        Administrators may suspend or revoke access for policy violations, inactive accounts, organisational offboarding,
        or security investigations. Sessions may be revoked individually or in bulk through security administration features
        where implemented.
      </p>
    ),
  },
  {
    id: 'law-amendments',
    title: '12. Institutional policies, law and amendments',
    content: (
      <>
        <p>
          Users must comply with applicable Indian law, institutional IT policies, and programme-specific directions for this
          deployment.
        </p>
        <p>
          These terms may be updated with a new version and review date. Continued use after notice constitutes acceptance
          where policy allows.
        </p>
        <p>
          <strong>Contact:</strong> {LEGAL_CONTACT_PLACEHOLDER}
        </p>
      </>
    ),
  },
]