import { LayoutGrid, Table2 } from 'lucide-react';
import TableCustomize from './TableCustomize.jsx';

/** Table / grid toggle + column & saved-view customization. */
export default function ListViewToolbar({ prefs, columns, lockedIds = [], showLayout = true }) {
  return (
    <div className="govern-list-toolbar">
      {showLayout ? (
        <div className="govern-view-toggle" role="group" aria-label="List layout">
          <button
            type="button"
            className={`govern-view-toggle__btn${prefs.layout === 'table' ? ' is-active' : ''}`}
            aria-pressed={prefs.layout === 'table'}
            title="Table view"
            onClick={() => prefs.setLayout('table')}
          >
            <Table2 size={18} aria-hidden />
            <span>Table</span>
          </button>
          <button
            type="button"
            className={`govern-view-toggle__btn${prefs.layout === 'grid' ? ' is-active' : ''}`}
            aria-pressed={prefs.layout === 'grid'}
            title="Grid view"
            onClick={() => prefs.setLayout('grid')}
          >
            <LayoutGrid size={18} aria-hidden />
            <span>Grid</span>
          </button>
        </div>
      ) : null}
      <TableCustomize prefs={prefs} columns={columns} lockedIds={lockedIds} />
    </div>
  );
}
