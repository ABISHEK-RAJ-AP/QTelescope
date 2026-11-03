import { useEffect, useRef, useState } from 'react';

export default function TableCustomize({ prefs, columns, lockedIds = [] }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const rootRef = useRef(null);
  const locked = new Set(lockedIds);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onPointer = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  return (
    <div className="govern-table-customize" ref={rootRef}>
      <button
        type="button"
        className="qre-btn qre-btn--ghost"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        Customize
      </button>
      {open ? (
        <div className="govern-table-customize__panel" role="dialog" aria-label="Customize list view">
          <p className="govern-table-customize__title">Visible columns</p>
          <ul className="govern-table-customize__list">
            {columns.map((col) => (
              <li key={col.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={prefs.isVisible(col.id)}
                    disabled={locked.has(col.id) && prefs.isVisible(col.id)}
                    onChange={() => prefs.toggle(col.id)}
                  />
                  {col.label}
                </label>
              </li>
            ))}
          </ul>
          <div className="govern-table-customize__row">
            <input
              className="qre-field__input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Save view name"
              aria-label="Saved view name"
            />
            <button
              type="button"
              className="qre-btn qre-btn--ghost"
              onClick={() => {
                prefs.saveView(name);
                setName('');
              }}
            >
              Save view
            </button>
          </div>
          {Object.keys(prefs.views).length ? (
            <ul className="govern-table-customize__views">
              {Object.keys(prefs.views).map((view) => (
                <li key={view}>
                  <button
                    type="button"
                    className={`qre-btn qre-btn--ghost${prefs.activeView === view ? ' is-active' : ''}`}
                    onClick={() => prefs.applyView(view)}
                  >
                    {view}
                  </button>
                  <button type="button" className="qre-btn qre-btn--ghost" onClick={() => prefs.deleteView(view)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="govern-muted">Views stay in this browser only.</p>
          )}
          <div className="govern-table-customize__row">
            <button type="button" className="qre-btn qre-btn--ghost" onClick={prefs.reset}>
              Reset columns
            </button>
            <button type="button" className="qre-btn qre-btn--ghost" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
