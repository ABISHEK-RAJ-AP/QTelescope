import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowBigUp, CornerDownLeft, Delete, X } from 'lucide-react';
import {
  applyA11ySettings,
  loadA11yPrefs,
  saveA11yPrefs,
} from '../../lib/accessibilityPrefs.js';
import './OnScreenKeyboard.css';

const ROWS = [
  { indent: 0, keys: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'] },
  { indent: 1, keys: ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'] },
  { indent: 2, keys: ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'] },
  { indent: 3, keys: [{ id: '⇧', mod: true, wide: true }, 'z', 'x', 'c', 'v', 'b', 'n', 'm', { id: '⌫', mod: true, wide: true }] },
  { indent: 0, keys: [{ id: 'Tab', mod: true }, { id: 'Space', space: true }, { id: 'Enter', mod: true, wide: true }] },
];

function keyId(k) {
  return typeof k === 'string' ? k : k.id;
}

function isTextTarget(el) {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === 'TEXTAREA') return true;
  if (tag === 'INPUT') {
    const t = el.type;
    return !t || ['text', 'search', 'email', 'url', 'password', 'number'].includes(t);
  }
  return el.isContentEditable;
}

function dismissKeyboard() {
  const s = loadA11yPrefs();
  const next = { ...s, onScreenKeyboard: false };
  applyA11ySettings(next);
  saveA11yPrefs(next);
}

export function OnScreenKeyboard() {
  const [shift, setShift] = useState(false);
  const [visible, setVisible] = useState(() => document.documentElement.hasAttribute('data-a11y-osk'));

  useEffect(() => {
    const sync = () => setVisible(document.documentElement.hasAttribute('data-a11y-osk'));
    sync();
    window.addEventListener('qtelescope-a11y-changed', sync);
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-a11y-osk'] });
    return () => {
      window.removeEventListener('qtelescope-a11y-changed', sync);
      obs.disconnect();
    };
  }, []);

  const sendKey = useCallback((key) => {
    const el = document.activeElement;
    if (!isTextTarget(el)) return;

    if (key === '⌫') {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        const start = el.selectionStart ?? el.value.length;
        const end = el.selectionEnd ?? start;
        if (start === end && start > 0) {
          el.value = el.value.slice(0, start - 1) + el.value.slice(end);
          el.selectionStart = el.selectionEnd = start - 1;
        } else if (start !== end) {
          el.value = el.value.slice(0, start) + el.value.slice(end);
          el.selectionStart = el.selectionEnd = start;
        }
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return;
    }

    if (key === 'Enter') {
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
      if (el.tagName === 'TEXTAREA') {
        const start = el.selectionStart ?? el.value.length;
        el.value = `${el.value.slice(0, start)}\n${el.value.slice(start)}`;
        el.selectionStart = el.selectionEnd = start + 1;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return;
    }

    if (key === 'Tab') {
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true }));
      return;
    }

    if (key === '⇧') {
      setShift((s) => !s);
      return;
    }

    const ch = key === 'Space' ? ' ' : (shift ? key.toUpperCase() : key);
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? start;
      el.value = el.value.slice(0, start) + ch + el.value.slice(end);
      el.selectionStart = el.selectionEnd = start + ch.length;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (el.isContentEditable) {
      document.execCommand('insertText', false, ch);
    }
    if (shift && key.length === 1) setShift(false);
  }, [shift]);

  if (!visible) return null;

  const renderKeyLabel = (id) => {
    if (id === '⌫') return <Delete size={18} strokeWidth={2} aria-hidden />;
    if (id === 'Enter') return <CornerDownLeft size={18} strokeWidth={2} aria-hidden />;
    if (id === '⇧') return <ArrowBigUp size={18} strokeWidth={2} aria-hidden />;
    if (id === 'Space') return 'Space';
    if (id === 'Tab') return 'Tab';
    return shift && id.length === 1 ? id.toUpperCase() : id;
  };

  const content = (
    <div className="osk-root" role="region" aria-label="On-screen keyboard">
      <div className="osk-glass">
        <div className="osk-chrome">
          <div className="osk-chrome__grip" aria-hidden>
            <span /><span /><span />
          </div>
          <p className="osk-chrome__title">On-screen keyboard</p>
          <span className="osk-chrome__hint">Focus a field, then type here</span>
          <button type="button" className="osk-chrome__close" onClick={dismissKeyboard} aria-label="Hide on-screen keyboard">
            <X size={16} aria-hidden />
          </button>
        </div>
        <div className="osk-board">
          <div className="osk-rows">
            {ROWS.map((row) => (
              <div
                key={row.keys.map(keyId).join('-')}
                className={`osk-row${row.indent ? ` osk-row--indent-${row.indent}` : ''}`}
              >
                {row.keys.map((k) => {
                  const id = keyId(k);
                  const mod = typeof k === 'object' && k.mod;
                  const wide = typeof k === 'object' && k.wide;
                  const space = typeof k === 'object' && k.space;
                  const active = id === '⇧' && shift;
                  return (
                    <button
                      key={id}
                      type="button"
                      className={[
                        'osk-key',
                        mod ? 'osk-key--mod' : '',
                        wide ? 'osk-key--wide' : '',
                        space ? 'osk-key--space' : '',
                        active ? 'osk-key--active' : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => sendKey(id)}
                      aria-label={id === 'Space' ? 'Space' : id}
                      aria-pressed={active || undefined}
                    >
                      {renderKeyLabel(id)}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
