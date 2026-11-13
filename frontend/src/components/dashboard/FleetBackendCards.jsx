import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { formatBackendTitle, formatModalityLabel, formatProviderLabel } from '@/lib/displayLabels.js';
import { buildBackendDetailsPath } from '@/lib/investigationLinks.js';
import { StateBar, StatusText } from '@/pages/backendCommon.jsx';
import { STATE_LABEL } from '@/pages/backendUtils.js';

function cardMeta(r) {
  const mod = formatModalityLabel(r.qpu_modality);
  const prov = formatProviderLabel(r.provider_id, r.cloud_name || r.provider_name || r.facility);
  const qubits = r.num_qubits ?? r.qubit_count;
  const bits = [mod, prov];
  if (qubits != null && Number.isFinite(Number(qubits))) bits.push(`${Number(qubits)} qubits`);
  return bits.join(' · ');
}

function alertLine(r) {
  if (r.crit > 0) return `${r.crit} critical`;
  if (r.warn > 0) return `${r.warn} warning`;
  return 'None open';
}

function queueLine(r) {
  if (r.pending == null) return 'Not reported';
  return String(r.pending);
}

function calLine(r) {
  const v = r.calFresh;
  if (!v || v === '—') return 'No snapshot';
  return v;
}

function routingLine(r) {
  const key = r.router || 'UNKNOWN';
  if (key === 'UNKNOWN') return 'Not assessed';
  return STATE_LABEL[key] || key;
}

function alertsHref(r, severity) {
  const params = new URLSearchParams({
    backend: r.backend_id,
    status: 'ACTIVE',
  });
  if (severity) params.set('severity', severity);
  return `/app/alerts?${params.toString()}`;
}

function FleetFlipCard({ r }) {
  const [open, setOpen] = useState(false);
  const title = formatBackendTitle({ backend_id: r.backend_id, backend_name: r.backend_name });
  const attention = r.crit > 0 || r.router === 'RED';
  const routeKey = (r.router || 'unknown').toLowerCase();
  const workspace = buildBackendDetailsPath(r.backend_id);
  const show = () => setOpen(true);
  const hide = () => setOpen(false);

  return (
    <article
      className={`fo-fleet-card${attention ? ' fo-fleet-card--attention' : ''}${open ? ' is-open' : ''}`}
      onMouseLeave={hide}
      aria-label={`${title}. Hover the summary for alerts, queue, and routing.`}
    >
      <div className="fo-fleet-card__flip">
        <div className="fo-fleet-card__face fo-fleet-card__face--front" onMouseEnter={show} onFocus={show}>
          <header className="fo-fleet-card__head">
            <div className="fo-fleet-card__titles">
              <h3 className="fo-fleet-card__name">{title}</h3>
              <p className="fo-fleet-card__meta">{cardMeta(r)}</p>
            </div>
            <StatusText status={r.operational_status || 'UNKNOWN'} />
          </header>
          <div className="fo-fleet-card__health">
            <StateBar counts={r.counts} label={`${title} qubit health`} emptyLabel="Health data not available yet" />
          </div>
        </div>

        <div className="fo-fleet-card__face fo-fleet-card__face--back" onMouseEnter={show}>
          <p className="fo-fleet-card__back-title">{title}</p>
          <dl className="fo-fleet-card__stats">
            <div><dt>Alerts</dt><dd>{alertLine(r)}</dd></div>
            <div><dt>Queue</dt><dd>{queueLine(r)}</dd></div>
            <div><dt>Calibration</dt><dd>{calLine(r)}</dd></div>
            <div><dt>Routing</dt><dd className={`fo-route fo-route--${routeKey}`}>{routingLine(r)}</dd></div>
          </dl>
          <div className="fo-fleet-card__back-actions">
            {r.crit > 0 ? (
              <Link className="btn btn-secondary btn-sm fo-fleet-card__action fo-fleet-card__action--crit" to={alertsHref(r, 'CRITICAL')}>
                Critical ({r.crit})
              </Link>
            ) : null}
            {r.warn > 0 ? (
              <Link className="btn btn-secondary btn-sm fo-fleet-card__action" to={alertsHref(r, 'WARNING')}>
                Warnings ({r.warn})
              </Link>
            ) : null}
          </div>
        </div>
      </div>
      <Link
        className="btn btn-primary btn-sm fo-fleet-card__cta"
        to={workspace}
        onMouseEnter={hide}
        onFocus={hide}
      >
        Open workspace
      </Link>
    </article>
  );
}

export function FleetBackendCards({ rows = [], className = '' }) {
  if (!rows.length) return null;

  const n = rows.length;
  const gridClass = n >= 5 ? 'fo-fleet-cards__grid--5' : n === 4 ? 'fo-fleet-cards__grid--4' : n === 3 ? 'fo-fleet-cards__grid--3' : 'fo-fleet-cards__grid--2';

  return (
    <section
      className={`fo-fleet-cards card fo-fleet-cards--glass ds-glass-panel ${className}`.trim()}
      aria-labelledby="fo-fleet-cards-h"
      data-tour="page-fleet-cards"
    >
      <div className="fo-fleet-cards__head">
        <div>
          <h2 id="fo-fleet-cards-h" className="fo-fleet-cards__title">Backends</h2>
          <p className="fo-fleet-cards__sub">Hover the summary for ops detail. Open workspace stays on the card.</p>
        </div>
        <Link className="btn btn-secondary fo-fleet-cards__inventory" to="/app/backends/inventory">
          View inventory <ChevronRight size={14} aria-hidden />
        </Link>
      </div>
      <ul className={`fo-fleet-cards__grid ${gridClass}`} aria-label="Backend cards">
        {rows.map((r) => (
          <li key={r.backend_id} className="fo-fleet-cards__cell">
            <FleetFlipCard r={r} />
          </li>
        ))}
      </ul>
    </section>
  );
}
