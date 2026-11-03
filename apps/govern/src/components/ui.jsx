import { useEffect, useRef } from 'react';
import { DECISION_LABEL, labelDecision, labelState } from '../labels.js';

export function statusClass(state) {
  if (state === 'approved' || state === 'approve') return 'govern-status govern-status--ok';
  if (state === 'rejected' || state === 'withdrawn' || state === 'reject') return 'govern-status govern-status--bad';
  if (state === 'changes_requested') return 'govern-status govern-status--warn';
  if (state === 'in_review' || state === 'submitted_for_review' || state === 'pending_review') {
    return 'govern-status govern-status--warn';
  }
  return 'govern-status';
}

export function StatusBadge({ state, raw }) {
  const value = raw || state;
  const text = DECISION_LABEL[value] ? labelDecision(value) : labelState(value);
  return <span className={statusClass(state || value)}>{text || value}</span>;
}

export function PageHero({ eyebrow, title, subtitle, actions, chips, updatedAt }) {
  return (
    <header className="dashboard-header govern-page-header-band">
      <div className="govern-page-header-band__main">
        {eyebrow ? <p className="dashboard-org-name">{eyebrow}</p> : null}
        <h1 className="dashboard-title">{title}</h1>
        {subtitle ? <p className="dashboard-role-hint">{subtitle}</p> : null}
        {updatedAt ? <p className="govern-updated">{updatedAt.startsWith('Last') ? updatedAt : `Last updated: ${updatedAt}`}</p> : null}
        {chips?.length ? (
          <div className="govern-page-chips" role="list">
            {chips.map((chip) => (
              <span
                key={chip.key || chip.label}
                role="listitem"
                className={`govern-page-chip${chip.tone ? ` govern-page-chip--${chip.tone}` : ''}`}
              >
                {chip.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      {actions ? <div className="dashboard-header__actions">{actions}</div> : null}
    </header>
  );
}

/** Vendor list/settings header — title + purpose + actions. Not the dashboard band. */
export function PageHeaderRow({ title, subtitle, actions }) {
  return (
    <header className="page-header-row">
      <div>
        <h1 className="page-header-row__title">{title}</h1>
        {subtitle ? <p className="page-header-row__sub">{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-header-row__actions">{actions}</div> : null}
    </header>
  );
}

export function EmptyState({ title, hint, action }) {
  return (
    <div className="empty-state govern-empty">
      <span className="empty-state-icon govern-empty__mark" aria-hidden />
      <p className="empty-state-title govern-empty__title">{title}</p>
      {hint ? <p className="empty-state-desc govern-muted">{hint}</p> : null}
      {action ? <div className="govern-empty__actions">{action}</div> : null}
    </div>
  );
}

export function PageGuide({ items = [] }) {
  if (!items.length) return null;
  return (
    <div className="govern-page-guide">
      {items.map((item) => (
        <article key={item.title} className="govern-page-guide__item">
          <strong>{item.title}</strong>
          <p>{item.body}</p>
        </article>
      ))}
    </div>
  );
}

export function LoadingPanel({ label = 'Loading…', embedded = false }) {
  return (
    <div
      className={`${embedded ? 'dashboard-card dashboard-card--loading' : 'govern-page qre-card dashboard-card'} govern-boneyard`}
      aria-busy="true"
      aria-label={label}
    >
      <p className="govern-sr-only">{label}</p>
      <div className="govern-boneyard__toolbar">
        <span className="govern-skeleton" style={{ width: 140 }} />
        <span className="govern-skeleton" style={{ width: 88 }} />
        <span className="govern-skeleton" style={{ width: 64 }} />
      </div>
      <div className="govern-boneyard__kpi">
        <span className="govern-skeleton govern-boneyard__card" />
        <span className="govern-skeleton govern-boneyard__card" />
        <span className="govern-skeleton govern-boneyard__card" />
        <span className="govern-skeleton govern-boneyard__card" />
      </div>
      <div className="govern-boneyard__table">
        <span className="govern-skeleton govern-boneyard__row govern-boneyard__row--head" />
        <span className="govern-skeleton govern-boneyard__row" />
        <span className="govern-skeleton govern-boneyard__row" />
        <span className="govern-skeleton govern-boneyard__row" />
        <span className="govern-skeleton govern-boneyard__row" />
      </div>
    </div>
  );
}

/** Cert Studio kpi-grid row — clickable optional. */
export function QuotaMeter({ used = 0, cap = 0, remaining, warnPct = 20, label = 'Daily shot quota' }) {
  if (!cap) return null;
  const pct = Math.min(100, Math.round((Number(used) / Number(cap)) * 100));
  const remain = remaining ?? Math.max(0, cap - used);
  const warn = (remain / cap) * 100 <= warnPct;
  return (
    <div className={`govern-meter${warn ? ' govern-meter--warn' : ''}`}>
      <div className="govern-meter__head">
        <strong>{label}</strong>
        <span>
          {Number(remain).toLocaleString()} remaining · {Number(used).toLocaleString()} / {Number(cap).toLocaleString()}
        </span>
      </div>
      <div
        className="govern-meter__track"
        role="progressbar"
        aria-label={label}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="govern-meter__fill" style={{ width: `${pct}%` }} />
      </div>
      {warn ? <p className="govern-meter__hint">Headroom at or below {warnPct}% — new sims stay allowed until the cap is hit.</p> : null}
    </div>
  );
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ title, children, footer, onClose, wide = false }) {
  const panelRef = useRef(null);
  const open = !!(title || children);

  useEffect(() => {
    if (!open || !onClose) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const panel = panelRef.current;
    const prev = document.activeElement;
    const list = () => [...(panel?.querySelectorAll(FOCUSABLE) || [])].filter((el) => el.offsetParent !== null);
    list()[0]?.focus();
    const onKey = (e) => {
      if (e.key !== 'Tab' || !panel) return;
      const nodes = list();
      if (!nodes.length) {
        e.preventDefault();
        return;
      }
      const i = nodes.indexOf(document.activeElement);
      if (e.shiftKey) {
        if (i <= 0) {
          e.preventDefault();
          nodes[nodes.length - 1].focus();
        }
      } else if (i === nodes.length - 1 || i < 0) {
        e.preventDefault();
        nodes[0].focus();
      }
    };
    panel?.addEventListener('keydown', onKey);
    return () => {
      panel?.removeEventListener('keydown', onKey);
      if (prev && typeof prev.focus === 'function') prev.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="govern-confirm" role="dialog" aria-modal="true" aria-labelledby="govern-modal-title">
      <button type="button" className="govern-confirm__backdrop" tabIndex={-1} aria-hidden="true" onClick={onClose} />
      <div ref={panelRef} className={`govern-confirm__panel${wide ? ' govern-confirm__panel--wide' : ''}`}>
        {title ? <h3 id="govern-modal-title">{title}</h3> : null}
        {children}
        {footer ? <div className="govern-confirm__actions">{footer}</div> : null}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  body,
  children,
  confirmLabel = 'Confirm',
  danger = false,
  confirmDisabled = false,
  onCancel,
  onConfirm,
}) {
  if (!title) return null;
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="qre-btn qre-btn--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={`qre-btn ${danger ? 'qre-btn--accent' : 'qre-btn--primary'}`}
            disabled={confirmDisabled}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      {body ? <p>{body}</p> : null}
      {children}
    </Modal>
  );
}

export function QuickActions({ items = [], onOpen }) {
  if (!items.length) return null;
  return (
    <div className="govern-quick-actions">
      {items.map((item) => (
        <button
          key={item.route || item.label}
          type="button"
          className="govern-quick-actions__item"
          onClick={() => (item.onClick ? item.onClick() : onOpen?.(item.route))}
        >
          <span>
            <strong>{item.label}</strong>
            {item.hint ? <small>{item.hint}</small> : null}
          </span>
        </button>
      ))}
    </div>
  );
}

export function PeriodRange({ hours, onChange, options = [6, 24, 72, 168], min = 1, max = 720, label = 'Window' }) {
  return (
    <div className="govern-period" role="group" aria-label={label}>
      {options.map((h) => (
        <button
          key={h}
          type="button"
          className={`govern-period__pill${hours === h ? ' govern-period__pill--on' : ''}`}
          onClick={() => onChange(h)}
        >
          {h < 24 ? `${h}h` : h === 24 ? '24h' : `${h / 24}d`}
        </button>
      ))}
      <label className="govern-period__custom">
        <span className="qre-field__label">Custom (h)</span>
        <input
          className="qre-field__input"
          type="number"
          min={min}
          max={max}
          value={hours}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            if (!Number.isFinite(n)) return;
            onChange(Math.min(max, Math.max(min, n)));
          }}
        />
      </label>
    </div>
  );
}

export function WorkflowRail({ steps = [], onOpen }) {
  if (!steps.length) return null;
  return (
    <ol className="govern-flow">
      {steps.map((step, i) => (
        <li key={step.title}>
          <button type="button" className="govern-flow__item" onClick={() => onOpen?.(step.route)}>
            <span className="govern-flow__n">{i + 1}</span>
            <span>
              <strong>{step.title}</strong>
              {step.meta ? <small>{step.meta}</small> : null}
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}

export function FilterField({ value, onChange, placeholder = 'Search…', label = 'Search' }) {
  return (
    <label className="govern-filter">
      <span className="qre-field__label">{label}</span>
      <input
        className="govern-search"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
      />
    </label>
  );
}

export function KpiStrip({ items }) {
  if (!items?.length) return null;
  return (
    <div className="kpi-grid govern-kpi-grid" data-count={items.length}>
      {items.map((item) => {
        const Tag = item.onClick ? 'button' : 'div';
        return (
          <Tag
            key={item.key || item.label}
            type={item.onClick ? 'button' : undefined}
            className={[
              'kpi-card',
              'govern-kpi',
              item.tone || '',
              item.onClick ? 'kpi-card--clickable' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={item.onClick}
          >
            <p className="kpi-label govern-kpi__label">{item.label}</p>
            <p className="kpi-value govern-kpi__value">{item.value}</p>
            {item.hint ? <p className="kpi-sub govern-kpi__hint">{item.hint}</p> : null}
          </Tag>
        );
      })}
    </div>
  );
}

export function shortWorkloadId(id) {
  if (!id || id.length < 12) return id || '—';
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

export function SortTh({ label, sortKey, sort, onSort }) {
  const on = sort?.key === sortKey;
  return (
    <th aria-sort={on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        className="govern-sort"
        onClick={() => onSort(sortKey)}
        aria-pressed={on}
      >
        {label}
        {on ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
      </button>
    </th>
  );
}

export function ListCap({ count, cap, noun = 'rows' }) {
  if (!count || count < cap) return null;
  return (
    <p className="govern-muted" style={{ margin: '12px 0 0' }}>
      Showing first {cap} {noun}. Narrow filters to see older records.
    </p>
  );
}

export function WorkloadLink({ workloadId, onOpen, className = 'govern-table__primary' }) {
  return (
    <a
      href={`#/queue/${workloadId}`}
      className={className}
      title={workloadId}
      onClick={(e) => {
        e.preventDefault();
        onOpen?.(`#/queue/${workloadId}`);
      }}
    >
      {shortWorkloadId(workloadId)}
    </a>
  );
}
