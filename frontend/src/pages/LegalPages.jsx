import React from 'react'
import { LegalPageLayout } from '@/components/marketing/LegalPageLayout.jsx'
import { PRIVACY_SUBTITLE, privacySections } from '@/components/marketing/legalContent/privacySections.jsx'
import { TERMS_SUBTITLE, termsSections } from '@/components/marketing/legalContent/termsSections.jsx'
import { SECURITY_SUBTITLE, securitySections } from '@/components/marketing/legalContent/securitySections.jsx'

export function PrivacyPolicyPage() {
  return (
    <LegalPageLayout
      documentKind="privacy"
      title="Privacy Policy"
      subtitle={PRIVACY_SUBTITLE}
      sections={privacySections}
    />
  )
}

export function TermsPage() {
  return (
    <LegalPageLayout
      documentKind="terms"
      title="Terms of Operation"
      subtitle={TERMS_SUBTITLE}
      sections={termsSections}
    />
  )
}

export function SecurityNoticePage() {
  return (
    <LegalPageLayout
      documentKind="security"
      title="Security Notice"
      subtitle={SECURITY_SUBTITLE}
      sections={securitySections}
    />
  )
}