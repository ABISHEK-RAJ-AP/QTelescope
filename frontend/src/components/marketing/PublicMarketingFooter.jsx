import React from 'react'
import { Link } from 'react-router-dom'
import { Activity, Cpu, Layers, ExternalLink } from 'lucide-react'
import cdacLogo from '../../assets/cdaclogo.png'

const FOOTER_SECTIONS = [
  {
    title: 'Platform',
    links: [
      { name: 'Capabilities Overview', href: '/#capabilities' },
      { name: 'Hardware Telemetry', href: '/#features' },
      { name: 'Multi-QPU Inventory', href: '/app' },
      { name: 'Live Operations Console', href: '/app' },
    ],
  },
  {
    title: 'Architecture & Science',
    links: [
      { name: 'Qubit Coherence (T1/T2)', href: '/#features' },
      { name: 'Gate Fidelity Drift', href: '/#features' },
      { name: 'Calibration Provenance', href: '/#workflow' },
      { name: 'Automated Health Scoring', href: '/#features' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { name: 'Operations Guide', href: '/#faq' },
      { name: 'API Swagger Documentation', href: 'http://localhost:8000/docs', external: true },
      { name: 'Sign up', href: '/register' },
      { name: 'Sign in', href: '/login' },
    ],
  },
]

const LEGAL_LINKS = [
  { name: 'Privacy Policy', href: '/#faq' },
  { name: 'Terms of Operation', href: '/#faq' },
  { name: 'Security Notice', href: '/#faq' },
]

export function PublicMarketingFooter({ className = '', compact = false }) {
  const currentYear = new Date().getFullYear()

  if (compact) {
    return (
      <footer
        className={`relative z-20 w-full border-t border-neutral-200/80 bg-white/95 px-6 py-4 dark:border-neutral-800/80 dark:bg-[#070a0f]/95 backdrop-blur-md text-neutral-600 dark:text-neutral-400 ${className}`}
      >
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 sm:flex-row text-xs">
          <p>© {currentYear} C-DAC · Q-TeleScope quantum observability</p>
          <div className="flex flex-wrap justify-center gap-4">
            <a href="/#capabilities" className="font-semibold hover:text-cyan-600 dark:hover:text-cyan-400">Capabilities</a>
            <a href="/#faq" className="font-semibold hover:text-cyan-600 dark:hover:text-cyan-400">FAQ</a>
            <Link to="/app/overview" className="font-semibold hover:text-cyan-600 dark:hover:text-cyan-400">Console</Link>
          </div>
        </div>
      </footer>
    )
  }

  return (
    <footer
      className={`relative z-20 w-full border-t border-neutral-200/80 bg-white/95 dark:border-neutral-800/80 dark:bg-[#070a0f]/95 backdrop-blur-md text-neutral-800 dark:text-neutral-200 transition-colors duration-200 ${className}`}
    >
      <div className="w-full px-6 py-12 sm:px-8 lg:px-12 lg:py-16">
        {/* Top: Brand and Link Columns */}
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-5 lg:gap-12">
          {/* Brand Info Column */}
          <div className="lg:col-span-2 space-y-4">
            <Link to="/" className="flex items-center gap-3 group">
              <img
                src={cdacLogo}
                alt="C-DAC Logo"
                className="h-10 w-auto object-contain transition-transform group-hover:scale-105"
              />
              <div className="flex flex-col">
                <span className="font-extrabold text-xl tracking-tight text-neutral-950 dark:text-white">
                  Q-TeleScope
                </span>
                <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                  C-DAC Quantum Platform
                </span>
              </div>
            </Link>

            <p className="max-w-sm text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
              T1/T2 coherence, gate fidelity, calibration snapshots, and alerts for QPU fleets.
            </p>

            <div className="pt-2 text-xs text-neutral-500 dark:text-neutral-400">
              <span>Developed by Centre for Development of Advanced Computing (C-DAC)</span>
            </div>
          </div>

          {/* Nav Link Columns */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-3">
            {FOOTER_SECTIONS.map((section) => (
              <div key={section.title} className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                  {section.title}
                </h3>
                <ul className="space-y-2">
                  {section.links.map((link) => (
                    <li key={link.name}>
                      {link.external ? (
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-medium text-neutral-600 hover:text-cyan-600 dark:text-neutral-400 dark:hover:text-cyan-400 transition-colors"
                        >
                          <span>{link.name}</span>
                          <ExternalLink className="size-3 opacity-60" />
                        </a>
                      ) : (
                        <a
                          href={link.href}
                          className="text-sm font-medium text-neutral-600 hover:text-cyan-600 dark:text-neutral-400 dark:hover:text-cyan-400 transition-colors"
                        >
                          {link.name}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Bar: Copyright & Legal */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-neutral-200/80 pt-6 sm:flex-row dark:border-neutral-800/80">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            © {currentYear} Centre for Development of Advanced Computing (C-DAC). All rights reserved.
          </p>

          <div className="flex flex-wrap items-center gap-6 text-xs text-neutral-500 dark:text-neutral-400">
            {LEGAL_LINKS.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
              >
                {link.name}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}

export default PublicMarketingFooter
