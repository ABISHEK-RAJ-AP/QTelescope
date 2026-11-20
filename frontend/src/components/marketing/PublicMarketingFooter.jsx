import React, { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { usePublicRegistration } from '@/lib/usePublicRegistration'
import { QtTeleScopeMark } from '@/components/brand/QtTeleScopeMark.jsx'

const FOOTER_SECTIONS = [
  {
    title: 'Product',
    links: [
      { name: 'Capabilities', href: '/#capabilities' },
      { name: 'FAQ', href: '/#faq' },
      { name: 'Operations console', href: '/app/overview', route: true },
    ],
  },
  {
    title: 'Account',
    links: [
      { name: 'Sign in', href: '/login', route: true },
      { name: 'Sign up', href: '/register', route: true },
    ],
  },
]

export const LEGAL_LINKS = [
  { name: 'Privacy Policy', href: '/privacy' },
  { name: 'Terms of Operation', href: '/terms' },
  { name: 'Security Notice', href: '/security' },
]

function FooterNavLink({ link }) {
  const className =
    'text-sm font-medium text-neutral-600 hover:text-cyan-600 dark:text-neutral-400 dark:hover:text-cyan-400 transition-colors'
  if (link.route) {
    return (
      <Link to={link.href} className={className}>
        {link.name}
      </Link>
    )
  }
  return (
    <a href={link.href} className={className}>
      {link.name}
    </a>
  )
}

function LegalLink({ link, className = '' }) {
  const merged = `hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors ${className}`.trim()
  return (
    <Link to={link.href} className={merged}>
      {link.name}
    </Link>
  )
}

export function PublicMarketingFooter({ className = '', compact = false }) {
  const { allowed: registrationOpen } = usePublicRegistration()
  const currentYear = new Date().getFullYear()
  const footerSections = useMemo(
    () =>
      FOOTER_SECTIONS.map((section) => ({
        ...section,
        links: section.links.filter((l) => registrationOpen || l.href !== '/register'),
      })),
    [registrationOpen],
  )

  if (compact) {
    return (
      <footer
        className={`relative z-20 w-full border-t border-neutral-200/80 bg-white/95 px-6 py-4 dark:border-neutral-800/80 dark:bg-[#070a0f]/95 backdrop-blur-md text-neutral-600 dark:text-neutral-400 ${className}`}
      >
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 sm:flex-row text-xs">
          <p>© {currentYear} C-DAC · Q-TeleScope quantum observability</p>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 items-center">
            <a href="/#capabilities" className="font-semibold hover:text-cyan-600 dark:hover:text-cyan-400">
              Capabilities
            </a>
            <a href="/#faq" className="font-semibold hover:text-cyan-600 dark:hover:text-cyan-400">
              FAQ
            </a>
            <Link to="/app/overview" className="font-semibold hover:text-cyan-600 dark:hover:text-cyan-400">
              Console
            </Link>
            <span className="hidden sm:inline text-neutral-300 dark:text-neutral-700" aria-hidden>
              |
            </span>
            {LEGAL_LINKS.map((link) => (
              <LegalLink key={link.href} link={link} className="font-semibold text-neutral-600 dark:text-neutral-400" />
            ))}
          </div>
        </div>
      </footer>
    )
  }

  return (
    <footer
      id="footer"
      className={`relative z-20 w-full border-t border-neutral-200/80 bg-white/95 dark:border-neutral-800/80 dark:bg-[#070a0f]/95 backdrop-blur-md text-neutral-800 dark:text-neutral-200 transition-colors duration-200 ${className}`}
    >
      <div className="w-full px-6 py-12 sm:px-8 lg:px-12 lg:py-16">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-5 lg:gap-12">
          <div className="lg:col-span-2 space-y-4">
            <Link to="/" className="group inline-flex flex-col gap-1" aria-label="Q-TeleScope home">
              <QtTeleScopeMark
                size={40}
                className="qt-brand-lockup--header transition-transform group-hover:scale-[1.02]"
                decorative
              />
              <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 pl-0.5">
                C-DAC Quantum Platform
              </span>
            </Link>

            <p className="max-w-sm text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
              T1/T2 coherence, gate fidelity, calibration snapshots, and alerts for QPU fleets.
            </p>

            <div className="pt-2 text-xs text-neutral-500 dark:text-neutral-400">
              <span>Centre for Development of Advanced Computing (C-DAC)</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-3">
            {footerSections.map((section) => (
              <div key={section.title} className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                  {section.title}
                </h3>
                <ul className="space-y-2">
                  {section.links.map((link) => (
                    <li key={link.name}>
                      <FooterNavLink link={link} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                Legal
              </h3>
              <ul className="space-y-2">
                {LEGAL_LINKS.map((link) => (
                  <li key={link.href}>
                    <LegalLink link={link} className="text-sm font-medium text-neutral-600 dark:text-neutral-400" />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-neutral-200/80 pt-6 sm:flex-row dark:border-neutral-800/80">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            © {currentYear} Centre for Development of Advanced Computing (C-DAC). All rights reserved.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-neutral-500 dark:text-neutral-400">
            {LEGAL_LINKS.map((link) => (
              <LegalLink key={link.name} link={link} />
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}

export default PublicMarketingFooter