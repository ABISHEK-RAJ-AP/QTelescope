import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowRight, Moon, Sun, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useTheme } from '@/components/ui/ThemeProvider'
import cdacLogo from '../../assets/cdaclogo.png'

export function PublicMarketingHeader({ className = '' }) {
  const { pathname } = useLocation()
  const { resolved, setTheme } = useTheme()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const isDark = resolved === 'dark'
  const onLogin = pathname.startsWith('/login')
  const onRegister = pathname.startsWith('/register')

  const navLinks = [
    { label: 'Capabilities', href: '/#capabilities' },
    { label: 'Modules', href: '/#features' },
    { label: 'Workflow', href: '/#workflow' },
    { label: 'FAQ', href: '/#faq' },
  ]

  return (
    <header
      className={`sticky top-0 z-50 w-full min-h-[72px] border-b border-neutral-200/60 bg-white/80 backdrop-blur-xl transition-colors duration-200 dark:border-neutral-800/60 dark:bg-[#070a0f]/75 ${className}`}
    >
      {/* 100% Full-Viewport Width: Logo at far left, Nav in center, Actions at far right */}
      <div className="w-full flex min-h-[72px] items-center justify-between px-6 sm:px-8 lg:px-12">
        {/* Left End: C-DAC Brand & Title (Clean, NO container box around logo) */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <Link to="/" className="flex items-center gap-3 group">
            <img
              src={cdacLogo}
              alt="C-DAC Logo"
              className="h-10 w-auto object-contain transition-transform group-hover:scale-105"
            />
            <div className="flex flex-col">
              <span className="font-extrabold text-xl tracking-tight text-neutral-950 dark:text-white whitespace-nowrap">
                Q-TeleScope
              </span>
              <span className="hidden sm:block text-[10.5px] font-semibold tracking-wider uppercase text-neutral-500 dark:text-neutral-400 -mt-1 whitespace-nowrap">
                Quantum Observability
              </span>
            </div>
          </Link>
        </div>

        {/* Center: Clean Nav Links (Centered) */}
        <nav className="hidden md:flex items-center gap-2 lg:gap-3">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="px-3.5 py-1.5 text-sm font-semibold text-neutral-600 hover:text-cyan-600 dark:text-neutral-300 dark:hover:text-cyan-400 rounded-lg hover:bg-neutral-100/60 dark:hover:bg-neutral-800/50 transition-colors whitespace-nowrap"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Right End: Actions & Theme Toggle */}
        <div className="flex items-center gap-2.5 sm:gap-3 flex-shrink-0">
          {/* Theme Switcher */}
          <button
            type="button"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            aria-label="Toggle theme"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-700 shadow-sm transition hover:bg-neutral-100 hover:text-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white"
          >
            {isDark ? <Sun className="size-4 text-amber-400" /> : <Moon className="size-4" />}
          </button>

          {/* Sign In Link */}
          <Link
            to="/login"
            className={`hidden sm:inline-flex px-3.5 py-1.5 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
              onLogin
                ? 'text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/40'
                : 'text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:text-white dark:hover:bg-neutral-800/60'
            }`}
          >
            Sign In
          </Link>

          <Link to="/register">
            <Button
              size="sm"
              className="gap-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold shadow-sm px-4 py-2 text-sm whitespace-nowrap"
            >
              Sign up
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          </Link>

          {/* Mobile Menu Hamburger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Nav Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#070a0f] px-6 py-4 space-y-2">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 text-base font-semibold text-neutral-700 hover:text-cyan-600 dark:text-neutral-300 dark:hover:text-cyan-400 rounded-lg"
            >
              {link.label}
            </a>
          ))}
          <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 flex gap-2">
            <Link
              to="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-2 text-sm font-semibold rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-2 text-sm font-semibold rounded-lg bg-cyan-600 text-white"
            >
              Register
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}

export default PublicMarketingHeader
