import React from 'react'
import { CDAC_HOME_URL } from '@/lib/publicBrand.js'

export function LegalNote({ children }) {
  return <p className="legal-note">{children}</p>
}

export function LegalList({ items }) {
  return (
    <ul>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

export function CdacInstitutionLine() {
  return (
    <p>
      Institutional policies and programme information for C-DAC are published at{' '}
      <a href={CDAC_HOME_URL} target="_blank" rel="noopener noreferrer">
        www.cdac.in
      </a>
      . This document supplements those policies for this Q-TeleScope deployment.
    </p>
  )
}