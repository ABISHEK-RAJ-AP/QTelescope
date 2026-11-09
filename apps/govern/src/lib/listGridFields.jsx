import RecordGrid, { GridField } from '../components/RecordGrid.jsx';

/** Render grid cards from field specs gated by prefs.isVisible(columnId). */
export function ListGridBody({ items, prefs, rowKey, onRowClick, fields, footer }) {
  return (
    <>
      <RecordGrid items={items} rowKey={rowKey} onRowClick={onRowClick}>
        {(item) => (
          <>
            {fields.map(({ id, label, wide, render }) =>
              prefs.isVisible(id) ? (
                <GridField key={id} label={label} wide={wide}>
                  {render(item)}
                </GridField>
              ) : null,
            )}
          </>
        )}
      </RecordGrid>
      {footer}
    </>
  );
}
