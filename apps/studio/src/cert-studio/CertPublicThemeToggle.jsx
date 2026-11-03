import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { readTheme, setTheme } from '@qre-theme/theme.js';

export default function CertPublicThemeToggle({ className = '', embedded = false }) {
  const [theme, setLocal] = useState(readTheme);
  const isDark = theme === 'dark' || theme === 'high-contrast';

  useEffect(() => {
    const sync = () => setLocal(readTheme());
    window.addEventListener('qre-theme-changed', sync);
    return () => window.removeEventListener('qre-theme-changed', sync);
  }, []);

  function toggleTheme() {
    setTheme(isDark ? 'light' : 'dark');
    setLocal(readTheme());
  }

  return (
    <button
      type="button"
      className={`intro-theme-toggle notranslate${embedded ? ' intro-theme-toggle--embedded' : ''} ${className}`.trim()}
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      {isDark ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
    </button>
  );
}
