import React from 'react';

/** Restrained SVG — providers → Q-TeleScope hub (decorative, no external assets). */
export function OnboardingConnectivityIllustration() {
  return (
    <svg
      className="onboarding-connectivity-illustration"
      viewBox="0 0 400 280"
      role="img"
      aria-labelledby="ob-connectivity-title"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title id="ob-connectivity-title">Quantum providers connected to a unified monitoring platform</title>
      <defs>
        <linearGradient id="ob-hub-glow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.15" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <rect width="400" height="280" fill="url(#ob-hub-glow)" rx="16" />
      <g fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.35">
        <path d="M80 70 L200 140" />
        <path d="M80 210 L200 140" />
        <path d="M320 70 L200 140" />
        <path d="M320 210 L200 140" />
      </g>
      <g className="onboarding-connectivity-illustration__node">
        <circle cx="80" cy="70" r="28" stroke="currentColor" strokeWidth="1.5" fill="var(--bg-card, #fff)" />
        <text x="80" y="74" textAnchor="middle" fontSize="9" fill="currentColor" fontWeight="600">Cloud</text>
        <circle cx="80" cy="210" r="28" stroke="currentColor" strokeWidth="1.5" fill="var(--bg-card, #fff)" />
        <text x="80" y="214" textAnchor="middle" fontSize="8" fill="currentColor" fontWeight="600">On-prem</text>
        <circle cx="320" cy="70" r="28" stroke="currentColor" strokeWidth="1.5" fill="var(--bg-card, #fff)" />
        <text x="320" y="74" textAnchor="middle" fontSize="8" fill="currentColor" fontWeight="600">Simulator</text>
        <circle cx="320" cy="210" r="28" stroke="currentColor" strokeWidth="1.5" fill="var(--bg-card, #fff)" />
        <text x="320" y="214" textAnchor="middle" fontSize="8" fill="currentColor" fontWeight="600">Ion</text>
      </g>
      <circle cx="200" cy="140" r="44" stroke="currentColor" strokeWidth="2" fill="color-mix(in srgb, currentColor 12%, var(--bg-card, #fff))" />
      <text x="200" y="136" textAnchor="middle" fontSize="10" fill="currentColor" fontWeight="700">Q-TeleScope</text>
      <text x="200" y="152" textAnchor="middle" fontSize="8" fill="currentColor" opacity="0.75">Unified view</text>
    </svg>
  );
}