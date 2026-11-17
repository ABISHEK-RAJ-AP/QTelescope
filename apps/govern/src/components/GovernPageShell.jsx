import { useEffect, useMemo } from 'react';
import Breadcrumbs from '@qre-theme/Breadcrumbs.jsx';
import { errorKind } from '../pages/ErrorPage.jsx';
import { inferNoticeTone, toast } from '../lib/toast.js';
import { LoadingPanel, PageHeaderRow, PageHero } from './ui.jsx';
import GovernContextBar from './GovernContextBar.jsx';
import HeaderRefresh from './HeaderRefresh.jsx';
import { useGovernSession } from '../hooks/useGovernSession.js';

/**
 * Cert Studio page host.
 * variant="band" → flat overview band (Overview only).
 * variant="page" → vendor page-header-row (lists, settings, detail).
 */
export default function GovernPageShell({
  eyebrow,
  title,
  subtitle,
  actions,
  chips,
  loading = false,
  error = '',
  notice = '',
  noticeOk,
  onRetry,
  onOpen,
  breadcrumbs = null,
  workflow: _workflow = null,
  quickActions: _quickActions = null,
  loadingLabel = 'Loading…',
  children,
  className = '',
  guideItems: _guideItems = null,
  updatedAt = '',
  variant = 'page',
  showContext = true,
  me = null,
}) {
  const { me: sessionMe } = useGovernSession();
  const contextMe = me ?? sessionMe;

  const rootClass = ['page-content', 'page-enter', 'govern-page', variant === 'band' ? 'govern-dashboard-stack' : '', className]
    .filter(Boolean)
    .join(' ');

  useEffect(() => {
    if (!notice) return;
    toast(notice, noticeOk === undefined ? inferNoticeTone(notice) : noticeOk ? 'ok' : 'err');
  }, [notice, noticeOk]);

  useEffect(() => {
    if (!onRetry) return undefined;
    const onRefresh = () => onRetry();
    window.addEventListener('qre-page-refresh', onRefresh);
    return () => window.removeEventListener('qre-page-refresh', onRefresh);
  }, [onRetry]);

  const kind = error ? errorKind(error) : '';
  const headerActions = (
    <>
      {showContext ? <GovernContextBar me={contextMe} /> : null}
      {onRetry ? <HeaderRefresh labeled={variant !== 'band'} loading={loading} /> : null}
      {actions}
    </>
  );

  const breadcrumbItems = useMemo(() => {
    if (!breadcrumbs?.length) return [];
    return breadcrumbs.map((crumb, i) => {
      const last = i === breadcrumbs.length - 1;
      const hash = !last && crumb.hash ? crumb.hash : null;
      return {
        label: crumb.label,
        href: hash || undefined,
        onClick:
          hash && onOpen
            ? (e) => {
                e.preventDefault();
                onOpen(hash);
              }
            : undefined,
      };
    });
  }, [breadcrumbs, onOpen]);

  const headerBlock =
    variant === 'band' ? (
      <div className="govern-page-header-stack govern-page-header-stack--band">
        {breadcrumbItems.length ? <Breadcrumbs items={breadcrumbItems} /> : null}
        <PageHero eyebrow={eyebrow} title={title} subtitle={subtitle} actions={headerActions} chips={chips} updatedAt={updatedAt} />
      </div>
    ) : (
      <div className="govern-page-header-stack">
        {breadcrumbItems.length ? <Breadcrumbs items={breadcrumbItems} /> : null}
        <PageHeaderRow title={title} subtitle={subtitle} actions={headerActions} />
      </div>
    );

  return (
    <div className={rootClass}>
      {headerBlock}
      {error ? (
        <div className={`qre-alert${kind === 'forbidden' ? ' govern-notice--warn' : ''}`} role="alert">
          <strong>{kind === 'forbidden' ? 'Permission required' : kind === 'notfound' ? 'Not found' : 'Request failed'}</strong>
          <p style={{ margin: '6px 0 0' }}>{error}</p>
          {onRetry ? (
            <button type="button" className="qre-btn qre-btn--ghost" style={{ marginTop: 8 }} onClick={onRetry}>
              Retry
            </button>
          ) : null}
        </div>
      ) : null}
      {loading ? <LoadingPanel label={loadingLabel} embedded /> : children}
    </div>
  );
}
