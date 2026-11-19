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
    evidenceDesc: 'Immutable ZIP of alerts, incidents, calibration and qubit summaries, sealed with SHA-256 hashes for later verification.',
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
      'Choose the category that matches your organisation. Government and university paths include ministry, department, branch, and facility masters.',
    registerProfileAside:
      'Complete the organisation fields for your category, then your account credentials. We will email a one-time verification code.',
    registerOtpAside:
      'Enter the six-digit code from your email to finish creating your account.',
    registerClosed: 'Registration is managed by your organisation administrator.',
    registerApprovalNote:
      'After email verification, a platform administrator must approve your account before the first sign-in. Your organisation assigns access during that review.',
    registerOtpSubtitle: 'Enter the verification code to finish creating your account.',
    registerOtpHintScreen:
      'A one-time code is shown in an on-screen notification because outbound email is not configured for this environment.',
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
