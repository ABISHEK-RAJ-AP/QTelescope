import React, { useState } from 'react';
import { Search, X } from 'lucide-react';
import { UI_LANGUAGES } from '../../lib/accessibilityPrefs.js';

export function CegLangPanel({ onClose, onSelect, current }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const matches = (lang) => !q
    || lang.label.toLowerCase().includes(q)
    || lang.englishLabel.toLowerCase().includes(q)
    || lang.code.toLowerCase().includes(q);
  const english = UI_LANGUAGES.find((l) => l.code === 'en' && matches(l));
  const indic = UI_LANGUAGES.filter((l) => l.code !== 'en' && matches(l));

  return (
    <div className="fd-ceg-popover fd-ceg-popover--lang" role="dialog" aria-label="Select language">
      <div className="fd-ceg-popover__title-row">
        <span className="fd-ceg-lang__title">Language</span>
        <button type="button" className="fd-ceg-popover__icon-x" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
      </div>
      <p className="fd-ceg-lang__hint">UI copy stays English today; preference is stored for future i18n.</p>
      <label className="fd-ceg-lang__search">
        <Search size={14} aria-hidden className="fd-ceg-lang__search-ic" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search languages…"
          aria-label="Search languages"
          autoComplete="off"
        />
      </label>
      {english && (
        <>
          <div className="fd-ceg-lang__section-label">Default</div>
          <button
            type="button"
            className={`fd-ceg-lang__option${current === english.code ? ' fd-ceg-lang__option--active' : ''}`}
            onClick={() => onSelect(english.code)}
          >
            {english.label}
          </button>
        </>
      )}
      <div className="fd-ceg-lang__section-label">Indian languages</div>
      {indic.length ? (
        <div className="fd-ceg-lang__list fd-ceg-lang__list--grid">
          {indic.map(({ code, label, englishLabel }) => (
            <button
              key={code}
              type="button"
              className={`fd-ceg-lang__option${current === code ? ' fd-ceg-lang__option--active' : ''}`}
              onClick={() => onSelect(code)}
            >
              <span className="fd-ceg-lang__option-native">{label}</span>
              <span className="fd-ceg-lang__option-en">{englishLabel}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="fd-ceg-lang__empty">No match.</p>
      )}
    </div>
  );
}
