import { useEffect } from 'react';
import { errorKind } from '../pages/ErrorPage.jsx';
import { inferNoticeTone, toast } from '../lib/toast.js';
import { LoadingPanel, PageHeaderRow, PageHero } from './ui.jsx';
import GovernContextBar from './GovernContextBar.jsx';
import HeaderRefresh from './HeaderRefresh.jsx';

/**
 * Cert Studio page host.
 * variant="band" → dashboard gradient header (Overview / analytics).
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
  onOpen: _onOpen,
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
      {showContext ? <GovernContextBar me={me} /> : null}
      {onRetry ? <HeaderRefresh labeled={variant !== 'band'} loading={loading} /> : null}
      {actions}
    </>
  );

  return (
    <div className={rootClass}>
      {variant === 'band' ? (
        <PageHero eyebrow={eyebrow} title={title} subtitle={subtitle} actions={headerActions} chips={chips} updatedAt={updatedAt} />
      ) : (
        <PageHeaderRow title={title} subtitle={subtitle} actions={headerActions} />
      )}
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
