import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useTableKit } from '../../hooks/useTableKit.js';
import { SortableTh } from './DataViewToolbar.jsx';
import { TableEmpty } from './EmptyState.jsx';
import './enterpriseDataTable.css';

function TableSkeleton({ columns, rows = 5 }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <tr key={`sk-${i}`} className="edt-skel-row" aria-hidden>
          {columns.map((c) => (
            <td key={c.key}>
              <span className="edt-skel" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

const DEFAULT_PAGE_SIZES = [10, 15, 25, 50, 100];

function Pagination({
  page,
  totalPages,
  totalCount,
  pageSize,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  onPage,
  onPageSize,
}) {
  if (totalCount === 0) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);
  const showPager = totalCount > pageSize || pageSizeOptions.length > 1;

  return (
    <footer className="edt-pager" role="navigation" aria-label="Table pagination">
      <span className="edt-pager__count" role="status">
        {start}–{end} of {totalCount}
      </span>
      <div className="edt-pager__btns">
        {pageSizeOptions.length > 1 && (
          <label className="edt-pager__size">
            <span className="sr-only">Rows per page</span>
            <select
              className="input-control input-control--compact"
              value={pageSize}
              aria-label="Rows per page"
              onChange={(e) => {
                onPageSize(Number(e.target.value));
                onPage(1);
              }}
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
          </label>
        )}
        {showPager && (
          <>
            <button type="button" className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => onPage(1)}>
              First
            </button>
            <button type="button" className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
              Previous
            </button>
            <span className="edt-pager__meta">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={page >= totalPages}
              onClick={() => onPage(page + 1)}
            >
              Next
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={page >= totalPages}
              onClick={() => onPage(totalPages)}
            >
              Last
            </button>
          </>
        )}
      </div>
    </footer>
  );
}

/**
 * Client-side sort, search, and pagination for operational tables.
 * ponytail: server-side filtering still page-owned; this is shared chrome only.
 */
export function EnterpriseDataTable({
  rows = [],
  columns,
  loading = false,
  searchPlaceholder = 'Search…',
  searchKeys = [],
  pageSize: initialPageSize = 15,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  emptyTitle = 'No rows',
  emptyMessage = 'Nothing matched the current filters.',
  toolbarExtra = null,
  tableClassName = 'custom-table custom-table--dense',
  initialSort = null,
  stickyHeader = true,
  ariaLabel = 'Data table',
  onRowClick = null,
  rowClassName = '',
}) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState(initialSort || { key: null, dir: 'asc' });
  const [pageSize, setPageSize] = useState(initialPageSize);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    const keys = searchKeys.length ? searchKeys : columns.map((c) => c.key);
    return rows.filter((row) =>
      keys.some((k) => String(row[k] ?? '').toLowerCase().includes(q)),
    );
  }, [rows, query, searchKeys, columns]);

  const sortKey = sort.key;
  const kitRows = useMemo(() => {
    if (!sortKey) return filtered;
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') {
        return sort.dir === 'asc' ? av - bv : bv - av;
      }
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortKey, sort.dir]);

  const { pageRows, page, setPage, totalPages, totalCount } = useTableKit(kitRows, {
    pageSize,
    initialSort: sortKey ? sort : null,
  });

  const wrapClass = `edt-wrap table-container${stickyHeader ? ' edt-wrap--sticky' : ''}`;

  return (
    <div className="edt">
      <div className="edt-toolbar" role="toolbar" aria-label="Table controls">
        <label className="edt-search">
          <Search size={15} aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
          />
        </label>
        {toolbarExtra}
        <span className="edt-toolbar__count" role="status">
          {loading ? 'Loading…' : `${totalCount} shown`}
        </span>
      </div>
      <div className={wrapClass}>
        <table className={tableClassName} aria-label={ariaLabel}>
          <thead>
            <tr>
              {columns.map((col) =>
                col.sortable === false ? (
                  <th key={col.key} scope="col">
                    {col.label}
                  </th>
                ) : (
                  <SortableTh
                    key={col.key}
                    sort={sort}
                    sortKey={col.key}
                    defaultDir={col.defaultSortDir || 'asc'}
                    onToggle={setSort}
                  >
                    {col.label}
                  </SortableTh>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {loading && <TableSkeleton columns={columns} />}
            {!loading && pageRows.length === 0 && (
              <TableEmpty colSpan={columns.length} title={emptyTitle} message={emptyMessage} />
            )}
            {!loading &&
              pageRows.map((row, idx) => (
                <tr
                  key={row.id ?? row.key ?? `${idx}-${columns[0]?.key}`}
                  className={[onRowClick ? 'edt-row--click al-row-clickable' : '', rowClassName].filter(Boolean).join(' ') || undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  role={onRowClick ? 'button' : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onRowClick(row);
                          }
                        }
                      : undefined
                  }
                >
                  {columns.map((col) => (
                    <td key={col.key} className={col.className}>
                      {col.render ? col.render(row) : row[col.key] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <Pagination
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={pageSize}
        pageSizeOptions={pageSizeOptions}
        onPage={setPage}
        onPageSize={setPageSize}
      />
    </div>
  );
}
