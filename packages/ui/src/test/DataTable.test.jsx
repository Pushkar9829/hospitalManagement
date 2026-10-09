import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable, EmptyState, nextSort } from '../index.js';

const columns = [
  { accessorKey: 'billNo', header: 'Bill no.', enableSorting: true, meta: { mono: true } },
  { accessorKey: 'mode', header: 'Mode' },
  { accessorKey: 'amount', header: 'Amount', enableSorting: true, meta: { align: 'right' } },
];
const data = [
  { id: 'a', billNo: 'OP/26-27/000001', mode: 'UPI', amount: '₹1,385' },
  { id: 'b', billNo: 'OP/26-27/000002', mode: 'Card', amount: '₹2,400' },
];

describe('DataTable', () => {
  it('cycles sort ascending, descending, off', () => {
    expect(nextSort(undefined, 'amount')).toBe('amount');
    expect(nextSort('amount', 'amount')).toBe('-amount');
    expect(nextSort('-amount', 'amount')).toBeUndefined();
    expect(nextSort('-amount', 'billNo')).toBe('billNo');
  });

  it('reports sort changes and shows aria-sort', async () => {
    const onSortChange = vi.fn();
    const user = userEvent.setup();
    render(
      <DataTable
        columns={columns}
        data={data}
        sort="-amount"
        onSortChange={onSortChange}
        caption="Bills"
      />,
    );
    const amountHeader = screen.getByRole('columnheader', { name: /Amount/ });
    expect(amountHeader).toHaveAttribute('aria-sort', 'descending');
    expect(screen.getByRole('columnheader', { name: /Bill no/ })).toHaveAttribute(
      'aria-sort',
      'none',
    );
    expect(screen.getByRole('columnheader', { name: 'Mode' })).not.toHaveAttribute('aria-sort');
    await user.click(screen.getByRole('button', { name: 'Sort by Bill no.' }));
    expect(onSortChange).toHaveBeenLastCalledWith('billNo');
    await user.click(screen.getByRole('button', { name: 'Sort by Amount' }));
    expect(onSortChange).toHaveBeenLastCalledWith(undefined);
  });

  it('pages with previous and next', async () => {
    const onPageChange = vi.fn();
    const user = userEvent.setup();
    render(
      <DataTable
        columns={columns}
        data={data}
        total={60}
        page={2}
        limit={25}
        onPageChange={onPageChange}
      />,
    );
    expect(screen.getByText('26–50 of 60')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onPageChange).toHaveBeenLastCalledWith(3);
    await user.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(onPageChange).toHaveBeenLastCalledWith(1);
  });

  it('disables next on the last page', () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        total={2}
        page={1}
        limit={25}
        onPageChange={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
  });

  it('opens a row with a click or with Enter', async () => {
    const onRowClick = vi.fn();
    const user = userEvent.setup();
    render(<DataTable columns={columns} data={data} onRowClick={onRowClick} />);
    const rows = screen.getAllByRole('row').slice(1);
    await user.click(within(rows[0]).getByText('UPI'));
    expect(onRowClick).toHaveBeenLastCalledWith(data[0]);
    rows[1].focus();
    await user.keyboard('{Enter}');
    expect(onRowClick).toHaveBeenLastCalledWith(data[1]);
    expect(onRowClick).toHaveBeenCalledTimes(2);
  });

  it('shows skeleton rows while loading and the empty state when there is no data', () => {
    const { rerender } = render(<DataTable columns={columns} data={[]} loading limit={5} />);
    expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getAllByRole('row')).toHaveLength(1 + 5);
    expect(screen.getByText('Loading rows')).toBeInTheDocument();
    rerender(
      <DataTable columns={columns} data={[]} empty={<EmptyState title="No bills today" />} />,
    );
    expect(screen.getByText('No bills today')).toBeInTheDocument();
  });
});
