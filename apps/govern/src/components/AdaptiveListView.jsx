import { ListGridBody } from '../lib/listGridFields.jsx';

function fieldsFromColumns(columns = []) {
  return columns
    .filter((c) => c.id !== 'actions' || c.gridRender)
    .map((c) => ({
      id: c.id,
      label: c.label,
      wide: c.gridWide,
      render:
        c.gridRender
        || ((row) => {
          const v = row[c.id];
          if (v != null && v !== '') return String(v);
          return '—';
        }),
    }));
}

/** Table or card grid sharing prefs.layout + column visibility. */
export default function AdaptiveListView({
  prefs,
  items,
  rowKey,
  onRowClick,
  gridFields,
  columns,
  table,
  footer = null,
}) {
  const fields = gridFields?.length ? gridFields : fieldsFromColumns(columns);
  if (prefs.layout === 'grid' && fields.length) {
    return (
      <ListGridBody
        items={items}
        prefs={prefs}
        rowKey={rowKey}
        onRowClick={onRowClick}
        fields={fields}
        footer={footer}
      />
    );
  }
  return (
    <>
      {table}
      {footer}
    </>
  );
}
