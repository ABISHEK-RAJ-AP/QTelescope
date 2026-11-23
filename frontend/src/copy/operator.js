/**
 * Operator-facing copy — no schema names, deployment jargon, or dev internals in primary UI.
 * Import from pages; keep API paths and identifiers in drawers/admin only.
 */

export const COPY = {
  telemetry: {
    noHistory: 'No measurement history for this scope yet.',
    noStored: 'No measurements stored for this backend yet. Wait for the next collection cycle.',
    notEnoughSamples: 'Not enough measurements to show a trend.',
    sparseSparkline: 'Need at least two samples',
    connectCta: 'Connect a provider and run collection to populate charts.',
  },
  replay: {
    noFrames: 'No historical frames for this window. Collect telemetry first.',
    notLive:
      'Replay uses stored collector samples — not a live vendor feed. Scrub frames to inspect what was saved at each poll.',
    staleCollector:
      'Nothing new has been saved since the newest frame below. The collector may be paused; check admin collection or provider credentials.',
    coverageLegend:
      'Coverage colours: grey — = no sample for that panel; amber ! = sample present but stale or low quality; green ✓ = valid sample. These are not qubit health red/yellow/green states.',
    queueUnknownProvider:
      'Some providers (e.g. Rigetti QCS) do not publish queue depth — a dash means unknown, not zero jobs waiting.',
  },
  queue: {
    historySub: 'measurement history',
    historyProvenance: 'Stored queue samples; line connects points — not live streaming.',
    sparseTrend: 'Not enough history to plot a trend.',
  },
  incidents: {
    noLinkedAlerts: 'No alerts linked to this incident.',
  },
  reports: {
    evidenceDesc: 'Tamper-evident ZIP bundles (alerts, incidents, calibration, qubit summaries) with manifest and package SHA-256 hashes for verification before archival.',
  },
  platform: {
    dbUnreachable: 'Data store unreachable — check Settings → System health.',
    dbOk: 'Queries responding',
  },
  calibration: {
    expandLookback: 'Widen the lookback window or wait for more qubit measurements.',
  },
  overview: {
    heroAlerts: 'Alerts and routing',
    heroFleet: 'Fleet summary',
  },
  landing: {
    ctaBody: 'Use organization-issued credentials to open the fleet monitoring console.',
  },
  auth: {
    signInSubtitle: 'Access the quantum telemetry console with your assigned credentials.',
    signInFailed: 'Sign-in failed. Check the image and credentials.',
    serviceUnavailable: 'Sign-in is temporarily unavailable. Try again in a moment.',
    captchaUnavailable: 'Could not load the security image. Try again.',
    signInDirectory: 'This deployment accepts organization directory credentials.',
    registerSubtitle: 'Select organisation type, enter your details, then verify email.',
    registerTypeAside:
      'Select the organisation category that applies to you. Government and academic paths collect ministry, department, branch, and facility details in structured masters.',
    registerOrgStepSubtitle: 'Complete the organisation masters for your selected category.',
    registerAccountStepSubtitle: 'Username, email, and password for sign-in.',
    registerOrgAside: 'Select ministry, department, branch, and facility for your category.',
    registerAccountAside: 'Create your sign-in credentials. We will send a verification code to your email.',
    registerOtpAside:
      'Enter the six-digit code from your email to finish creating your account.',
    registerClosed: 'Registration is managed by your organisation administrator.',
    registerApprovalNote:
      'Only shown when this deployment requires access approval before the first sign-in.',
    accessIntroFleet:
      'Fleet-wide view of pending registrations, invitations, and account status across all organisations.',
    accessIntroOrg:
      'Organisation-scoped view of pending registrations and active members.',
    accessInviteSubtitle:
      'Creates an active account immediately. Share the temporary password through a secure channel; the member sets a new password under Account settings.',
    accessPendingSubtitle:
      'Accounts land here after email verification when admin approval is enabled. Assign a role, then approve or reject.',
    accessRejectedSubtitle:
      'Rejected registrations remain for audit. Re-open to return an account to the pending queue.',
    registerOtpSubtitle: 'Enter the verification code to finish creating your account.',
    registerOtpHintScreen:
      'Demo mode: check the notification at the top right of the screen for your six-digit code, then enter it below.',
    registerOtpToastAgain: 'Show code in notification again',
    registerOtpScreenCodeLabel: 'Your verification code',
    registerOtpHintEmail: 'Enter the 6-digit code we sent to your email address.',
    forgotSubtitle: 'Enter your username. For security, the response does not indicate whether an account exists.',
    resetSubtitle: 'Enter your reset token and set a new password.',
    mfaHint: 'Requires a TOTP authenticator app (6-digit code at sign-in). SMS is not used.',
  },
  shell: {
    notFoundTitle: 'Page not found',
    notFoundBody: 'This address is not part of Q-TeleScope. Check the path, or open a page from the navigation.',
    crashTitle: 'This page failed to render',
    crashBody: 'The view hit an error before it could finish. Try again. If it repeats, reload the console.',
    deniedTitle: 'Access restricted',
    deniedBody: '{role} cannot open this page.',
  },
};

/** @deprecated prefer COPY.telemetry.* — re-export for gradual migration */
export const OPERATOR = COPY;
