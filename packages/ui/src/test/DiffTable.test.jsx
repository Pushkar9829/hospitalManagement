import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { DiffTable, diffRows, flatten } from '../index.js';

describe('diffRows', () => {
  it('flattens nested objects to dot paths and keeps lists whole', () => {
    expect(flatten({ a: { b: 1, c: { d: 'x' } }, list: [1, 2] })).toEqual({
      'a.b': 1,
      'a.c.d': 'x',
      list: [1, 2],
    });
  });

  it('marks changed fields, treats blank values as equal and drops empty or omitted rows', () => {
    const rows = diffRows(
      { status: 'ACTIVE', floor: '', id: '1', rate: 500 },
      { status: 'INACTIVE', floor: undefined, id: '1', rate: 500, rooms: '' },
      { omit: ['id'] },
    );
    expect(rows).toEqual([
      { key: 'status', before: 'ACTIVE', after: 'INACTIVE', changed: true },
      { key: 'rate', before: 500, after: 500, changed: false },
    ]);
  });
});

describe('DiffTable', () => {
  it('shows before and after with changes marked by more than colour', () => {
    render(
      <DiffTable
        before={{ services: { opd: false }, name: 'Nephro' }}
        after={{ services: { opd: true }, name: 'Nephro', opdTimings: [{ day: 1 }] }}
        labels={{ 'services.opd': 'OPD' }}
        beforeLabel="Current"
        afterLabel="Proposed"
        caption="What changes"
      />,
    );
    const table = screen.getByRole('table', { name: 'What changes' });
    expect(within(table).getByRole('columnheader', { name: 'Proposed' })).toBeInTheDocument();
    const opd = within(table).getByRole('row', { name: /OPD/ });
    expect(opd).toHaveTextContent('No');
    expect(opd).toHaveTextContent('Yes (changed)');
    const unchanged = within(table).getByRole('row', { name: /name/ });
    expect(unchanged).not.toHaveTextContent('changed');
    expect(within(table).getByRole('row', { name: /opdTimings/ })).toHaveTextContent('"day": 1');
  });

  it('says so when nothing was recorded', () => {
    render(<DiffTable before={null} after={{ floor: '' }} />);
    expect(screen.getByText('No field values were recorded.')).toBeInTheDocument();
  });
});
