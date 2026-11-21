import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TableEmpty } from './EmptyState.jsx';

describe('TableEmpty', () => {
  it('renders a div block outside tables', () => {
    const html = renderToStaticMarkup(
      <TableEmpty as="block" title="Empty" message="Nothing here." />,
    );
    expect(html).toContain('obs-table-empty-block');
    expect(html).not.toContain('<tr');
  });

  it('renders a table row inside tbody', () => {
    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <TableEmpty colSpan={3} title="Empty" message="Nothing here." />
        </tbody>
      </table>,
    );
    expect(html).toContain('obs-table-empty-row');
  });
});