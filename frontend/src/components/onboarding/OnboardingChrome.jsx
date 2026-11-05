import React from 'react';
import { Link } from 'react-router-dom';
import { Check, Moon, SkipForward, Sun } from 'lucide-react';
import { QuantumBackground } from '@/components/ui/quantum-background';
import { PublicMarketingFooter } from '@/components/marketing/PublicMarketingFooter';
import { useTheme } from '@/components/ui/ThemeProvider';
import cdacLogo from '../../assets/cdaclogo.png';

export const STEP_LABELS = ['Overview', 'Integrations', 'Inventory', 'Console'];
export const STEP_IDS = ['welcome', 'connect', 'analyze', 'features'];

export function OnboardingMarketingHeader({ currentUser, onExit, stepIndex, onStepChange, maxReachableIndex }) {
  const { resolved, setTheme } = useTheme();
  const isDark = resolved === 'dark';

  return (
    <header className="relative z-30 w-full shrink-0 border-b border-neutral-200/60 bg-white/85 backdrop-blur-xl dark:border-neutral-800/60 dark:bg-[#070a0f]/80">
      <div className="flex min-h-[56px] w-full items-center gap-4 px-4 sm:px-6 lg:px-10">
        <Link to="/app/overview" className="flex shrink-0 items-center gap-3 group">
          <img
            src={cdacLogo}
            alt="C-DAC"
            className="h-9 w-auto object-contain transition-transform group-hover:scale-105"
          />
          <div className="flex flex-col">
            <span className="text-lg font-extrabold tracking-tight text-neutral-950 dark:text-white">
              Q-TeleScope
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-700 dark:text-cyan-400">
              Platform setup
            </span>
          </div>
        </Link>

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
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

      <ol className="onboarding-dot-stepper" aria-label="Setup steps">
        {STEP_LABELS.map((label, i) => {
          const active = i === stepIndex;
          const done = i < stepIndex;
          const reachable = i <= maxReachableIndex;
          return (
            <li
              key={STEP_IDS[i]}
              className={`onboarding-dot-step${active ? ' is-active' : ''}${done ? ' is-done' : ''}`}
            >
              <button
                type="button"
                disabled={!reachable}
                onClick={() => reachable && !active && onStepChange(STEP_IDS[i])}
                aria-current={active ? 'step' : undefined}
                className="onboarding-dot-step__btn"
              >
                <span className="onboarding-dot-step__dot" aria-hidden>
                  {done ? <Check size={14} strokeWidth={2.5} /> : i + 1}
                </span>
                <span className="onboarding-dot-step__label">{label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </header>
  );
}

export function OnboardingShell({ children, footer, currentUser, onExit, stepIndex, onStepChange, maxReachableIndex }) {
  return (
    <div className="onboarding-shell onboarding-shell--marketing relative flex min-h-dvh flex-col text-neutral-900 dark:text-neutral-100">
      <QuantumBackground />
      <OnboardingMarketingHeader
        currentUser={currentUser}
        onExit={onExit}
        stepIndex={stepIndex}
        onStepChange={onStepChange}
        maxReachableIndex={maxReachableIndex}
      />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        {children}
        {footer}
      </div>
      <div className="relative z-20 mt-auto shrink-0">
        <PublicMarketingFooter compact />
      </div>
    </div>
  );
}
