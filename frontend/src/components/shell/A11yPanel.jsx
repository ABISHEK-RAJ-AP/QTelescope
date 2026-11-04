import React from 'react';
import {
  Accessibility, CircleDot, Eye, Keyboard, Link2, Minus, Moon, Plus, RotateCcw, Sun, X,
} from 'lucide-react';
import {
  A11Y_DEFAULTS,
  applyA11ySettings,
  saveA11yPrefs,
} from '../../lib/accessibilityPrefs.js';

function A11yBtn({ label, icon, onClick, active, title: tip }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      title={tip}
      className="fd-ceg-a11y__btn"
      data-active={active ? 'true' : undefined}
    >
      <span className="fd-ceg-a11y__btn-icon">{icon}</span>
      <span className="fd-ceg-a11y__btn-label">{label}</span>
    </button>
  );
}

export function A11yPanel({ settings, onChange, onClose }) {
  const {
    contrast, fontSize, textSpacing, lineHeight, dyslexia, focusMode, pauseAnim,
    bigCursor, adhdMode, highlightLinks, hideImages, textToSpeech, onScreenKeyboard,
  } = settings;

  const set = (key, val) => {
    let next = { ...settings, [key]: val };
    if (key === 'pauseAnim' && val) {
      next = { ...next, disableWebGLBackground: true };
    }
    applyA11ySettings(next);
    saveA11yPrefs(next);
    onChange(next);
  };

  const resetAll = () => {
    const next = { ...A11Y_DEFAULTS };
    applyA11ySettings(next);
    saveA11yPrefs(next);
    onChange(next);
    window.speechSynthesis?.cancel();
  };

  const sec = (title) => <p className="fd-ceg-a11y__section">{title}</p>;

  return (
    <div className="fd-ceg-popover fd-ceg-popover--wide" role="dialog" aria-label="Accessibility options">
      <div className="fd-ceg-popover__title-row">
        <div className="fd-ceg-popover__title-main">
          <Accessibility size={20} aria-hidden />
          <span>Accessibility options</span>
        </div>
        <div className="fd-ceg-popover__title-actions">
          <button type="button" className="fd-ceg-popover__reset" onClick={resetAll}>Reset all</button>
          <button type="button" className="fd-ceg-popover__icon-x" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
      </div>

      {sec('Contrast & color')}
      <div className="fd-ceg-a11y__grid">
        <A11yBtn label="High contrast" icon={<Moon size={20} />} onClick={() => set('contrast', contrast === 'high' ? 'normal' : 'high')} active={contrast === 'high'} />
        <A11yBtn label="Grayscale" icon={<CircleDot size={20} />} onClick={() => set('contrast', contrast === 'gray' ? 'normal' : 'gray')} active={contrast === 'gray'} />
        <A11yBtn label="Low saturation" icon={<Sun size={20} />} onClick={() => set('contrast', contrast === 'dark' ? 'normal' : 'dark')} active={contrast === 'dark'} />
        <A11yBtn label="Normal" icon={<Sun size={20} />} onClick={() => set('contrast', 'normal')} active={contrast === 'normal'} />
      </div>

      {sec(`Text size — ${fontSize}%`)}
      <div className="fd-ceg-a11y__grid">
        <A11yBtn label="Bigger" icon={<Plus size={20} />} onClick={() => set('fontSize', Math.min(fontSize + 10, 170))} active={fontSize > 100} />
        <A11yBtn label="Smaller" icon={<Minus size={20} />} onClick={() => set('fontSize', Math.max(fontSize - 10, 70))} active={fontSize < 100} />
        <A11yBtn label="Text spacing" icon={<Link2 size={20} />} onClick={() => set('textSpacing', !textSpacing)} active={textSpacing} />
        <A11yBtn label="Line height" icon={<Eye size={20} />} onClick={() => set('lineHeight', !lineHeight)} active={lineHeight} />
      </div>

      {sec('Reading aids')}
      <div className="fd-ceg-a11y__grid">
        <A11yBtn label="Dyslexia font" icon={<span className="fd-ceg-a11y__aa">Aa</span>} onClick={() => set('dyslexia', !dyslexia)} active={dyslexia} />
        <A11yBtn label="Focus mode" icon={<Eye size={20} />} onClick={() => set('focusMode', !focusMode)} active={focusMode} title="Stronger focus rings; de-emphasizes secondary chrome" />
        <A11yBtn label="Reading line" icon={<Accessibility size={20} />} onClick={() => set('adhdMode', !adhdMode)} active={adhdMode} title="Dimmed band follows the pointer to reduce visual clutter" />
        <A11yBtn label="Highlight links" icon={<Link2 size={20} />} onClick={() => set('highlightLinks', !highlightLinks)} active={highlightLinks} />
      </div>

      {sec('General')}
      <div className="fd-ceg-a11y__grid">
        <A11yBtn label="Text to speech" icon={<span className="fd-ceg-a11y__aa">▶</span>} onClick={() => set('textToSpeech', !textToSpeech)} active={textToSpeech} />
        <A11yBtn label="Big cursor" icon={<span className="fd-ceg-a11y__aa">↖</span>} onClick={() => set('bigCursor', !bigCursor)} active={bigCursor} />
        <A11yBtn label="Reduce motion" icon={<RotateCcw size={20} />} onClick={() => set('pauseAnim', !pauseAnim)} active={pauseAnim} title="Stops transitions and freezes WebGL marketing backgrounds" />
        <A11yBtn label="Hide images" icon={<CircleDot size={20} />} onClick={() => set('hideImages', !hideImages)} active={hideImages} />
        <A11yBtn label="On-screen keyboard" icon={<Keyboard size={20} />} onClick={() => set('onScreenKeyboard', !onScreenKeyboard)} active={onScreenKeyboard} title="Type into focused text fields from the bottom keyboard" />
      </div>

      <p className="fd-ceg-popover__foot">Preferences saved in this browser only.</p>
    </div>
  );
}
