import React, { useCallback, useEffect, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ExternalLink, FileText, Printer, Shield, Lock } from 'lucide-react'
import { PublicMarketingHeader } from '@/components/marketing/PublicMarketingHeader'
import { PublicMarketingFooter } from '@/components/marketing/PublicMarketingFooter'
import { CDAC_HOME_URL } from '@/lib/publicBrand.js'
import {
  LEGAL_DOC_VERSION,
  LEGAL_EFFECTIVE_DATE,
  LEGAL_LAST_REVIEWED,
  LEGAL_ORG_NAME,
} from '@/components/marketing/legalDocumentMeta.js'
import '@/components/marketing/legal-pages.css'

const KIND_META = {
  privacy: { label: 'Privacy Policy', Icon: Shield, accent: 'legal-page--privacy' },
  terms: { label: 'Terms of Operation', Icon: FileText, accent: 'legal-page--terms' },
  security: { label: 'Security Notice', Icon: Lock, accent: 'legal-page--security' },
}

function scrollToSection(id) {
  const el = document.getElementById(id)
  if (!el) return
  const top = el.getBoundingClientRect().top + window.scrollY - 96
  window.scrollTo({ top, behavior: 'smooth' })
}

export function LegalPageLayout({
  documentKind = 'privacy',
  title,
  subtitle,
  sections = [],
  children,
}) {
  const kind = KIND_META[documentKind] || KIND_META.privacy
  const { Icon } = kind
  const [activeId, setActiveId] = useState(sections[0]?.id ?? '')
  const [mobileTocOpen, setMobileTocOpen] = useState(false)
  const mobileTocId = useId()

  useEffect(() => {
    const prior = document.title
    document.title = `Q-TeleScope — ${title}`
    return () => {
      document.title = prior
    }
  }, [title])

  useEffect(() => {
    if (!sections.length) return undefined
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (visible[0]?.target?.id) setActiveId(visible[0].target.id)
      },
      { rootMargin: '-20% 0px -55% 0px', threshold: [0, 0.25, 0.5] },
    )
    sections.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [sections])

  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  const renderBody = sections.length > 0 ? (
    sections.map(({ id, title: sectionTitle, content }) => (
      <section key={id} id={id} className="legal-section" aria-labelledby={`${id}-heading`}>
        <h2 id={`${id}-heading`} className="legal-section__title">
          {sectionTitle}
        </h2>
        <div className="legal-section__body">{content}</div>
      </section>
    ))
  ) : (
    <LegalContentWrap className="legal-prose">{children}</LegalContentWrap>
  )

  return (
    <div className={`legal-page min-h-screen flex flex-col ${kind.accent}`}>
      <PublicMarketingHeader />
      <main className="legal-page__main">
        <div className="legal-page__container">
          <nav className="legal-breadcrumb" aria-label="Breadcrumb">
            <ol className="legal-breadcrumb__list">
              <li>
                <Link to="/">Home</Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <span>Legal</span>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <span aria-current="page">{title}</span>
              </li>
            </ol>
          </nav>

          <header className="legal-page__header">
            <p className="legal-page__kicker">
              <Icon className="legal-page__kicker-icon" size={18} strokeWidth={2} aria-hidden />
              Legal &amp; governance
            </p>
            <h1 className="legal-page__title">{title}</h1>
            {subtitle ? <p className="legal-page__subtitle">{subtitle}</p> : null}
            <dl className="legal-page__meta">
              <div>
                <dt>Version</dt>
                <dd>{LEGAL_DOC_VERSION}</dd>
              </div>
              <div>
                <dt>Effective date</dt>
                <dd>{LEGAL_EFFECTIVE_DATE}</dd>
              </div>
              <div>
                <dt>Last reviewed</dt>
                <dd>{LEGAL_LAST_REVIEWED}</dd>
              </div>
              <div>
                <dt>Organisation</dt>
                <dd>{LEGAL_ORG_NAME}</dd>
              </div>
            </dl>
            <div className="legal-page__header-actions">
              <button type="button" className="legal-page__print" onClick={handlePrint}>
                <Printer size={16} aria-hidden />
                Print / Save PDF
              </button>
              <a href={CDAC_HOME_URL} target="_blank" rel="noopener noreferrer" className="legal-cdac-callout__link">
                C-DAC institutional site
                <ExternalLink className="size-3.5 shrink-0" aria-hidden />
              </a>
            </div>
          </header>

          <div className="legal-page__grid">
            {sections.length > 0 ? (
              <aside className="legal-toc legal-toc--desktop" aria-label="On this page">
                <p className="legal-toc__title">On this page</p>
                <ul className="legal-toc__list">
                  {sections.map(({ id, title: sectionTitle }) => (
                    <li key={id}>
                      <button
                        type="button"
                        className={`legal-toc__link${activeId === id ? ' legal-toc__link--active' : ''}`}
                        onClick={() => scrollToSection(id)}
                      >
                        {sectionTitle.replace(/^\d+\.\s*/, '')}
                      </button>
                    </li>
                  ))}
                </ul>
              </aside>
            ) : null}

            <article className="legal-page__article">
              {sections.length > 0 ? (
                <div className="legal-toc legal-toc--mobile">
                  <button
                    type="button"
                    className="legal-toc__mobile-toggle"
                    aria-expanded={mobileTocOpen}
                    aria-controls={mobileTocId}
                    onClick={() => setMobileTocOpen((v) => !v)}
                  >
                    On this page
                    <ChevronDown className={`legal-toc__chevron${mobileTocOpen ? ' legal-toc__chevron--open' : ''}`} size={18} aria-hidden />
                  </button>
                  {mobileTocOpen ? (
                    <ul id={mobileTocId} className="legal-toc__list legal-toc__list--mobile">
                      {sections.map(({ id, title: sectionTitle }) => (
                        <li key={id}>
                          <button
                            type="button"
                            className="legal-toc__link"
                            onClick={() => {
                              scrollToSection(id)
                              setMobileTocOpen(false)
                            }}
                          >
                            {sectionTitle}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
              {renderBody}
            </article>
          </div>
        </div>
      </main>
      <PublicMarketingFooter />
    </div>
  )
}

function LegalContentWrap({ className, children }) {
  return <div className={className}>{children}</div>
}

export default LegalPageLayout