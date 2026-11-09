import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EnterpriseDataTable } from './EnterpriseDataTable.jsx';

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'score', label: 'Score', defaultSortDir: 'desc' },
];

const data = [
  { id: '1', name: 'Alpha', score: 10 },
  { id: '2', name: 'Beta', score: 5 },
  { id: '3', name: 'Gamma', score: 8 },
];

describe('EnterpriseDataTable', () => {
  afterEach(() => cleanup());

  it('filters rows with search', async () => {
    const user = userEvent.setup();
    render(<EnterpriseDataTable rows={data} columns={columns} searchKeys={['name']} pageSize={10} />);
    await user.type(screen.getByRole('searchbox'), 'beta');
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
  });

  it('shows empty state when no matches', async () => {
    const user = userEvent.setup();
    render(
      <EnterpriseDataTable
        rows={data}
        columns={columns}
        emptyTitle="Nothing here"
        emptyMessage="Try another query."
      />,
    );
    await user.type(screen.getByRole('searchbox'), 'zzz');
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });
});
