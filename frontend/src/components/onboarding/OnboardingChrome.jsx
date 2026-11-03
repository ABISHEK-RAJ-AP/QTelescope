import React from 'react';
import { Link } from 'react-router-dom';
import { Moon, SkipForward, Sun } from 'lucide-react';
import { QuantumBackground } from '@/components/ui/quantum-background';
import { PublicMarketingFooter } from '@/components/marketing/PublicMarketingFooter';
import { useTheme } from '@/components/ui/ThemeProvider';
import cdacLogo from '../../assets/cdaclogo.png';

const STEP_LABELS = ['Overview', 'Integrations', 'Discovery', 'Signal map', 'Console'];

export function OnboardingMarketingHeader({ currentUser, onExit, stepIndex }) {
  const { resolved, setTheme } = useTheme();
  const isDark = resolved === 'dark';
  const progress = ((stepIndex + 1) / STEP_LABELS.length) * 100;

  return (
    <header className="relative z-30 w-full shrink-0 border-b border-neutral-200/60 bg-white/85 backdrop-blur-xl dark:border-neutral-800/60 dark:bg-[#070a0f]/80">
      <div className="flex min-h-[72px] w-full items-center justify-between gap-4 px-6 sm:px-8 lg:px-12">
        <Link to="/app/overview" className="flex shrink-0 items-center gap-3 group">
          <img
            src={cdacLogo}
            alt="C-DAC"
            className="h-10 w-auto object-contain transition-transform group-hover:scale-105"
          />
          <div className="flex flex-col">
            <span className="text-xl font-extrabold tracking-tight text-neutral-950 dark:text-white">
              Q-TeleScope
            </span>
            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-cyan-700 dark:text-cyan-400">
              Platform setup
            </span>
          </div>
        </Link>

        <div className="hidden md:flex flex-col items-center gap-1 min-w-0 flex-1 px-4">
          <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
            Step {stepIndex + 1} of {STEP_LABELS.length} · {STEP_LABELS[stepIndex]}
          </span>
          <div
            className="h-1.5 w-full max-w-md overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"
            role="progressbar"
            aria-valuenow={stepIndex + 1}
            aria-valuemin={1}
            aria-valuemax={STEP_LABELS.length}
            aria-label={`Setup progress: step ${stepIndex + 1}, ${STEP_LABELS[stepIndex]}`}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-600 to-violet-600 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {currentUser?.username && (
            <div className="hidden sm:flex flex-col items-end text-right leading-tight">
              <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">
                {currentUser.full_name || currentUser.username}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                {currentUser.role_label || currentUser.role}
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            aria-label="Toggle theme"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-700 shadow-sm hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            {isDark ? <Sun className="size-4 text-amber-400" /> : <Moon className="size-4" />}
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onExit}>
            <SkipForward size={14} aria-hidden /> Exit
          </button>
        </div>
      </div>
    </header>
  );
}

export function OnboardingStepNav({ step, stepIndex, onStepChange, maxReachableIndex }) {
  const ids = ['welcome', 'connect', 'analyze', 'map', 'features'];
  return (
    <nav
      className="relative z-20 shrink-0 border-b border-neutral-200/50 bg-white/70 px-4 py-3 dark:border-neutral-800/50 dark:bg-neutral-950/50 sm:px-8"
      aria-label="Setup steps"
    >
      <ol className="mx-auto flex max-w-6xl gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {STEP_LABELS.map((label, i) => {
          const active = i === stepIndex;
          const done = i < stepIndex;
          const reachable = i <= maxReachableIndex;
          return (
            <li key={ids[i]} className="shrink-0">
              <button
                type="button"
                disabled={!reachable || active}
                onClick={() => reachable && !active && onStepChange(ids[i])}
                aria-current={active ? 'step' : undefined}
                className={[
                  'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors',
                  active
                    ? 'border-cyan-600/50 bg-cyan-50 text-cyan-900 dark:border-cyan-500/40 dark:bg-cyan-950/40 dark:text-cyan-100'
                    : done
                      ? 'border-emerald-600/30 bg-emerald-50/80 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-200'
                      : 'border-neutral-200 bg-white text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400',
                  !reachable && 'opacity-45 cursor-not-allowed',
                ].join(' ')}
              >
                <span className="tabular-nums">{i + 1}</span>
                <span className="hidden sm:inline">{label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function OnboardingShell({ children, footer, currentUser, onExit, step, stepIndex, onStepChange, maxReachableIndex }) {
  return (
    <div className="onboarding-shell onboarding-shell--marketing relative flex min-h-dvh flex-col text-neutral-900 dark:text-neutral-100">
      <QuantumBackground />
      <OnboardingMarketingHeader currentUser={currentUser} onExit={onExit} stepIndex={stepIndex} />
      <OnboardingStepNav
        step={step}
        stepIndex={stepIndex}
        onStepChange={onStepChange}
        maxReachableIndex={maxReachableIndex}
      />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        {children}
        {footer}
      </div>
      <div className="relative z-20 mt-auto shrink-0">
        <PublicMarketingFooter />
      </div>
    </div>
  );
}
