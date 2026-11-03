import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';

/**
 * Cert Studio–style command palette (Govern routes only).
 */
export default function GovernCommandPalette({ commands = [], onNavigate }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('qre-open-command-palette', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('qre-open-command-palette', onOpen);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) => c.label.toLowerCase().includes(q) || (c.group || '').toLowerCase().includes(q),
    );
  }, [commands, query]);

  useEffect(() => {
    setActive(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) return undefined;
    document.body.classList.add('cert-modal-open');
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.classList.remove('cert-modal-open');
      document.body.style.overflow = prev;
    };
  }, [open]);

  function run(cmd) {
    if (!cmd) return;
    cmd.run?.();
    onNavigate?.(cmd.route);
    if (cmd.route) cmd.onClick?.();
    setOpen(false);
    setQuery('');
  }

  if (!open) return null;

  return (
    <div className="govern-cmd-palette" role="dialog" aria-modal="true" aria-label="Command palette">
      <button type="button" className="govern-cmd-palette__backdrop" aria-label="Close" onClick={() => setOpen(false)} />
      <div className="govern-cmd-palette__panel">
        <div className="govern-cmd-palette__search">
          <Search size={18} aria-hidden />
          <input
            autoFocus
            type="search"
            placeholder="Jump to page or action…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((i) => Math.min(filtered.length - 1, i + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((i) => Math.max(0, i - 1));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                run(filtered[active]);
              }
            }}
            aria-label="Search commands"
          />
          <kbd className="govern-cmd-palette__kbd">Esc</kbd>
        </div>
        <ul className="govern-cmd-palette__list" role="listbox">
          {filtered.length === 0 ? (
            <li className="govern-cmd-palette__empty">No matches</li>
          ) : (
            filtered.map((cmd, i) => (
              <li key={cmd.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  className={`govern-cmd-palette__item${i === active ? ' govern-cmd-palette__item--active' : ''}`}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => run(cmd)}
                >
                  <span className="govern-cmd-palette__label">{cmd.label}</span>
                  {cmd.group ? <span className="govern-cmd-palette__group">{cmd.group}</span> : null}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
