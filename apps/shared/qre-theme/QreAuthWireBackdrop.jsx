import CertStudioLoginWireBackdrop from './cert-studio/CertStudioLoginWireBackdrop.jsx';
import { readTheme, resolveDataTheme } from './theme.js';

/** @deprecated name — Cert Studio login wire (full gemini paths). */
export default function QreAuthWireBackdrop({ username = '', password = '', captchaInput = '', theme, variant }) {
  const isDark = variant === 'dark' || (theme ? theme === 'dark' || theme === 'high-contrast' : resolveDataTheme(readTheme()) !== 'light');
  return (
    <CertStudioLoginWireBackdrop
      email={username}
      password={password}
      captchaInput={captchaInput}
      captchaCode="AAAA"
      variant={isDark ? 'dark' : 'light'}
    />
  );
}
