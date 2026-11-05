import React from 'react';
import './ListPager.css';

export function ListPager({ page, pages, onPage, label = 'Page' }) {
  if (!pages || pages <= 1) return null;
  return (
    <nav className="list-pager" aria-label="Pagination">
      <button type="button" className="btn btn-secondary btn--xs" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <span>{label} {page} of {pages}</span>
      <button type="button" className="btn btn-secondary btn--xs" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </nav>
  );
}
