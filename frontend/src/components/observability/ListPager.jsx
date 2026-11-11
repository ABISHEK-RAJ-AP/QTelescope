import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './ListPager.css';

export function ListPager({ page, pages, onPage }) {
  if (!pages || pages <= 1) return null;
  return (
    <nav className="list-pager" aria-label="Pagination">
      <button
        type="button"
        className="btn btn-secondary btn-sm btn-icon-only"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        aria-label="Previous page"
        title="Previous"
      >
        <ChevronLeft size={18} aria-hidden />
      </button>
      <span className="list-pager__meta">{page} / {pages}</span>
      <button
        type="button"
        className="btn btn-secondary btn-sm btn-icon-only"
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
        aria-label="Next page"
        title="Next"
      >
        <ChevronRight size={18} aria-hidden />
      </button>
    </nav>
  );
}
