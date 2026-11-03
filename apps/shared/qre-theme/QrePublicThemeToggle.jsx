import { Moon, Sun, Contrast } from 'lucide-react';
import { applyTheme, readTheme, setTheme } from './theme.js';

export default function QrePublicThemeToggle({ className = '', embedded = false }) {
  const theme = readTheme();

  function toggleTheme() {
    const order = ['light', 'dark', 'high-contrast'];
    const next = order[(order.indexOf(theme) + 1) % order.length];
    setTheme(next);
    applyTheme(next);
  }

  const icon = theme === 'light' ? <Moon size={18} aria-hidden /> : theme === 'high-contrast' ? <Contrast size={18} aria-hidden /> : <Sun size={18} aria-hidden />;

  const cls = embedded
    ? `cert-public-header__theme-btn notranslate ${className}`.trim()
    : `intro-theme-toggle notranslate ${className}`.trim();

  return (
    <button
      type="button"
      className={cls}
      onClick={toggleTheme}
      aria-label={
        theme === 'high-contrast'
          ? 'Switch to light mode'
          : theme === 'light'
            ? 'Switch to dark mode'
            : 'Switch to high contrast mode'
      }
      title="Cycle theme (light, dark, high contrast)"
    >
      {icon}
    </button>
  );
}
