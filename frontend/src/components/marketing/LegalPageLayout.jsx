import React from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { QuantumBackground } from '@/components/ui/quantum-background'
import { PublicMarketingHeader } from '@/components/marketing/PublicMarketingHeader'
import { PublicMarketingFooter } from '@/components/marketing/PublicMarketingFooter'
import { CDAC_HOME_URL } from '@/lib/publicBrand.js'
import '@/components/marketing/legal-pages.css'

export function LegalPageLayout({ title, subtitle, children }) {
  return (
    <div className="legal-page min-h-screen flex flex-col bg-neutral-50 dark:bg-[#070a0f] text-neutral-800 dark:text-neutral-200">
      <QuantumBackground />
      <PublicMarketingHeader />
      <main className="relative z-10 flex-1 w-full">
        <div className="mx-auto w-full max-w-6xl px-6 sm:px-8 lg:px-12 py-10 lg:py-16">
          <div className="mx-auto w-full max-w-3xl">
            <nav aria-label="Breadcrumb">
              <Link
                to="/"
                className="text-sm font-semibold text-cyan-700 hover:text-cyan-600 dark:text-cyan-400 dark:hover:text-cyan-300"
              >
                ← Home
              </Link>
            </nav>
            <header className="mt-6 border-b border-neutral-200/80 pb-8 dark:border-neutral-800/80">
              <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 sm:text-4xl">
                {title}
              </h1>
              {subtitle ? (
                <p className="mt-3 text-base leading-relaxed text-neutral-600 dark:text-neutral-400">{subtitle}</p>
              ) : null}
              <div className="legal-cdac-callout mt-6">
                <p className="m-0 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
                  Authoritative institutional policies for C-DAC programmes are published on the official website.
                </p>
                <a
                  href={CDAC_HOME_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="legal-cdac-callout__link"
                >
                  Visit cdac.in
                  <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                </a>
              </div>
            </header>
            <article className="legal-prose mt-10">{children}</article>
          </div>
        </div>
      </main>
      <PublicMarketingFooter />
    </div>
  )
}

export default LegalPageLayout