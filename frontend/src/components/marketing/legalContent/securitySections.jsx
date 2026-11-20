import React from 'react'
import {
  LEGAL_CONTACT_PLACEHOLDER,
  LEGAL_SECURITY_REPORTING_PLACEHOLDER,
} from '@/components/marketing/legalDocumentMeta.js'
import { CdacInstitutionLine, LegalList, LegalNote } from './legalContentPrimitives.jsx'

export const SECURITY_SUBTITLE =
  'Security controls, responsible platform usage, vulnerability reporting and incident management for this deployment.'

export const securitySections = [
  {
    id: 'overview',
    title: '1. Security overview',
    content: (
      <>
        <p>
          Q-TeleScope processes sensitive operational data about quantum infrastructure, backend connectivity, and
          administrative actions. Protecting authentication, credentials, audit trails, and telemetry integrity is
          essential for trustworthy operations.
        </p>
        <CdacInstitutionLine />
        <LegalNote>
          This notice describes controls available in the product and deployment baseline. It does not publish internal
          network topology, hostnames, or undisclosed vulnerability details.
        </LegalNote>
      </>
    ),
  },
  {
    id: 'authentication',
    title: '2. Authentication and access control',
    content: (
      <LegalList
        items={[
          'Authenticated API access using bearer session tokens issued server-side.',
          'Role-based access control (RBAC) checked on protected routes and mutations.',
          'Optional TOTP-based MFA enrollment and verification where enabled.',
          'Optional login captcha to reduce automated credential stuffing.',
          'Optional LDAP bind when configured for enterprise directory authentication.',
          'Session listing and revocation capabilities for security administrators.',
        ]}
      />
    ),
  },
  {
    id: 'rbac',
    title: '3. Role-based access control',
    content: (
      <p>
        Capabilities are grouped into scopes such as telemetry read, alert actions, incident response, platform
        configuration, security administration, and developer studio access. The effective permission set is the union of
        capabilities assigned to your role. Platform and security administrators manage assignments consistent with
        least-privilege practice.
      </p>
    ),
  },
  {
    id: 'session-credentials',
    title: '4. Session and credential protection',
    content: (
      <>
        <p>
          Passwords are stored as hashes. Provider API keys and bootstrap secrets belong in server configuration, not in
          client source or public repositories. Operators should rotate credentials according to institutional policy.
        </p>
        <p>
          Browser <code>localStorage</code> may hold session tokens for console convenience; protect workstations and sign
          out on shared systems.
        </p>
      </>
    ),
  },
  {
    id: 'data-protection',
    title: '5. Data protection and communication',
    content: (
      <>
        <p>
          Production deployments should terminate TLS at the edge (reverse proxy or load balancer) so operator traffic is
          not sent in clear text over untrusted networks. Whether data at rest is encrypted depends on database and volume
          configuration for your hosting stack — confirm with platform owners before stating encryption-at-rest guarantees.
        </p>
      </>
    ),
  },
  {
    id: 'audit-monitoring',
    title: '6. Audit logging and security monitoring',
    content: (
      <>
        <p>Audit events may record authentication-related changes, profile updates, MFA enrollment, administrative edits, and other security-relevant actions. Administrators can search audit history within API limits.</p>
        <p>Operational alerting inside Q-TeleScope focuses on quantum fleet health; it is not a substitute for enterprise SIEM unless you integrate exports externally.</p>
      </>
    ),
  },
  {
    id: 'integration-security',
    title: '7. Backend and API integration security',
    content: (
      <LegalList
        items={[
          'Outbound calls to quantum provider APIs use credentials supplied by administrators.',
          'Inbound API routes enforce authentication dependencies except for explicitly public marketing and auth endpoints.',
          'CORS origins should be restricted in production via environment configuration.',
          'Rate limiting and environment flags (for example production mode) should be set per deployment hardening guides.',
        ]}
      />
    ),
  },
  {
    id: 'vulnerability-reporting',
    title: '8. Vulnerability reporting',
    content: (
      <>
        <p>If you believe you have found a security vulnerability:</p>
        <ol>
          <li>Document the affected component and plausible impact without accessing unrelated data.</li>
          <li>Do not exploit, modify, or exfiltrate data beyond what is necessary to demonstrate the issue.</li>
          <li>Report through the authorised channel below — do not disclose publicly until coordinated.</li>
          <li>Allow the designated team time to investigate and remediate.</li>
        </ol>
        <p>
          <strong>Reporting channel:</strong> {LEGAL_SECURITY_REPORTING_PLACEHOLDER}
        </p>
      </>
    ),
  },
  {
    id: 'incident-management',
    title: '9. Security incident management',
    content: (
      <>
        <p>Institutional incident handling typically includes:</p>
        <LegalList
          items={[
            'Identification and reporting by users or monitoring.',
            'Initial triage and severity assignment.',
            'Containment (session revocation, credential rotation, service isolation).',
            'Investigation and remediation.',
            'Recovery and post-incident review.',
          ]}
        />
        <LegalNote>
          Timelines for reporting to CERT-In or other authorities are governed by law and institutional policy — they are not
          committed here unless your C-DAC security team confirms applicability and procedures for this deployment.
        </LegalNote>
      </>
    ),
  },
  {
    id: 'limitations',
    title: '10. Security limitations',
    content: (
      <p>
        No software system can guarantee absolute security. Effectiveness depends on patching, configuration, network
        controls, physical security, and user behaviour. Follow authorised operational practices and escalate anomalies
        promptly.
      </p>
    ),
  },
  {
    id: 'updates-contact',
    title: '11. Security updates and contact',
    content: (
      <>
        <p>
          Security-relevant application updates should be applied through your standard change process. Important notices may
          be published on this page with an updated review date.
        </p>
        <p>
          <strong>Operational security contact:</strong> {LEGAL_CONTACT_PLACEHOLDER}
        </p>
        <p>
          <strong>Vulnerability reporting:</strong> {LEGAL_SECURITY_REPORTING_PLACEHOLDER}
        </p>
      </>
    ),
  },
]