import { useMemo } from 'react';
import { GEMINI_WIRE_PATHS as PATHS } from './geminiWirePaths.js';

const DARK_STROKES = ['#2dffbe', '#5eead4', '#38bdf8', '#60a5fa', '#34d399', '#a78bfa'];

function fieldProgress(email, password, captchaInput, captchaCode, fallback = 0.35) {
  if (email === undefined && password === undefined) return fallback;
  let score = 0;
  const user = String(email ?? '');
  if (user.includes('@') ? user.trim().length > 3 : user.trim().length >= 2) score += 1;
  if ((password ?? '').length >= 4) score += 1;
  const capIn = String(captchaInput ?? '').trim();
  const capLen = Math.max(4, String(captchaCode ?? 'AAAA').length);
  if (capIn.length >= Math.min(capLen, 4)) score += 1;
  return score / 3;
}

/** Cert Studio `LoginWireBackdrop`. */
export default function CertStudioLoginWireBackdrop({
  email = '',
  password = '',
  captchaInput = '',
  captchaCode = '',
  variant = 'light',
  progress: progressProp,
}) {
  const progress = useMemo(() => {
    if (typeof progressProp === 'number') return progressProp;
    return fieldProgress(email, password, captchaInput, captchaCode);
  }, [email, password, captchaInput, captchaCode, progressProp]);

  const isDark = variant === 'dark';

  return (
    <div className={`login-wire-backdrop${isDark ? ' login-wire-backdrop--dark' : ''}`} aria-hidden>
      <svg viewBox="0 0 1440 890" preserveAspectRatio="xMidYMid slice" className="login-wire-backdrop__svg">
        <defs>
          <filter id="qreLoginWireBlur">
            <feGaussianBlur in="SourceGraphic" stdDeviation={isDark ? 1.5 : 2.5} />
          </filter>
          {isDark ? (
            <filter id="qreLoginWireGlow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          ) : null}
        </defs>
        {PATHS.map((path, index) => {
          const stagger = index * 0.08;
          const lineProgress = Math.max(0, Math.min(1, (progress - stagger) / (1 - stagger + 0.01)));
          const stroke = isDark ? DARK_STROKES[index % DARK_STROKES.length] : path.stroke;
          return (
            <path
              key={`${path.stroke}-${index}`}
              d={path.d}
              fill="none"
              stroke={stroke}
              strokeWidth={isDark ? 2.75 : 2.25}
              pathLength={1}
              strokeDasharray="1"
              strokeDashoffset={1 - lineProgress}
              filter={isDark ? 'url(#qreLoginWireGlow)' : 'url(#qreLoginWireBlur)'}
              className="login-wire-backdrop__path"
              opacity={isDark ? 0.92 : 0.88}
            />
          );
        })}
      </svg>
    </div>
  );
}
