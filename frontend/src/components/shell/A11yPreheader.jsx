import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Accessibility, Languages } from 'lucide-react';
import {
  getUiLangLabel,
  loadA11yPrefs,
  loadUiLang,
  saveUiLang,
} from '../../lib/accessibilityPrefs.js';
import { A11yPanel } from './A11yPanel.jsx';
import { CegLangPanel } from './CegLangPanel.jsx';

export function A11yPreheader() {
  const barRef = useRef(null);
  const [openPanel, setOpenPanel] = useState(null);
  const [lang, setLang] = useState(() => loadUiLang());
  const [a11ySettings, setA11ySettings] = useState(() => loadA11yPrefs());

  useEffect(() => {
    const onLang = (e) => {
      if (e.detail?.code) setLang(e.detail.code);
      else setLang(loadUiLang());
    };
    window.addEventListener('qtelescope-lang-changed', onLang);
    return () => window.removeEventListener('qtelescope-lang-changed', onLang);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (barRef.current && !barRef.current.contains(e.target)) setOpenPanel(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (name) => setOpenPanel((p) => (p === name ? null : name));

  const handleSkipToMain = useCallback((e) => {
    e.preventDefault();
    const target = document.getElementById('page-content') || document.getElementById('main-content');
    if (!target) return;
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    const focusTarget = () => target.focus({ preventScroll: true });
    if (typeof target.scrollIntoView === 'function' && !reduced) {
      setTimeout(focusTarget, 350);
    } else {
      focusTarget();
    }
  }, []);

  const toolBtn = (id, title, icon, expanded) => (
    <button
      type="button"
      className="a11y-preheader__trigger"
      aria-label={title}
      aria-expanded={expanded}
      title={title}
      onClick={() => toggle(id)}
    >
      <span className="a11y-preheader__ic">{icon}</span>
    </button>
  );

  const langLabel = getUiLangLabel(lang);

  return (
    <div
      ref={barRef}
      className="a11y-preheader notranslate"
      role="toolbar"
      aria-label="Accessibility options"
      translate="no"
    >
      <a
        href="#page-content"
        className="a11y-preheader__skip"
        onClick={handleSkipToMain}
      >
        Skip to main content
      </a>
      <div className="a11y-preheader__tools">
        <div className="a11y-preheader__tool">
          {toolBtn('access', 'Accessibility settings', <Accessibility size={15} strokeWidth={2} aria-hidden />, openPanel === 'access')}
          {openPanel === 'access' && (
            <A11yPanel settings={a11ySettings} onChange={setA11ySettings} onClose={() => setOpenPanel(null)} />
          )}
        </div>
        <div className="a11y-preheader__tool">
          {toolBtn('lang', `Language: ${langLabel}`, <Languages size={15} strokeWidth={2} aria-hidden />, openPanel === 'lang')}
          {openPanel === 'lang' && (
            <CegLangPanel
              current={lang}
              onClose={() => setOpenPanel(null)}
              onSelect={(code) => {
                saveUiLang(code);
                setLang(code);
                setOpenPanel(null);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
