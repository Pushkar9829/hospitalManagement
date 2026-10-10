import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ROLE_GRANTS } from '@hms/shared';
import { errorBody, makeSession } from '../../test/fixtures.js';
import { mockApi, renderApp } from '../../test/renderApp.jsx';
import { masterFields } from './masters.js';
import { exampleNumber } from './numbering.js';

const BRANCH = {
  id: '64b000000000000000000001',
  name: 'Main Branch',
  code: 'MAIN',
  status: 'ACTIVE',
  version: 0,
};
const APPROVAL = 'a'.repeat(24);
const page = (items) => ({ items, page: 1, limit: 25, total: items.length });
const DEPT = {
  id: 'd'.repeat(24),
  code: 'CARD',
  name: 'Cardiology',
  type: 'CLINICAL',
  location: { branchId: BRANCH.id },
  services: { opd: true, ipd: true, procedures: false, diagnostics: false },
  opdTimings: [],
  status: 'ACTIVE',
  version: 2,
};

function setup(handlers = {}, path = '/settings/masters') {
  const fetchMock = mockApi({
    'GET /auth/me': () => [200, makeSession({ panel: 'admin', permissions: ROLE_GRANTS.admin })],
    'GET /branches': () => [200, [BRANCH]],
    'GET /departments': () => [200, page([DEPT])],
    'GET /users': () => [404, errorBody('NOT_FOUND')],
    ...handlers,
  });
  const utils = renderApp(path);
  return { ...utils, fetchMock, user: userEvent.setup() };
}

describe('Departments', () => {
  it('registers a department with OPD timings and shows that it waits for approval (202)', async () => {
    let body;
    const { user } = setup({
      'POST /departments': (_req, b) => (
        (body = b),
        [
          202,
          {
            department: { ...b, id: 'n'.repeat(24), status: 'PENDING_APPROVAL' },
            approvalId: APPROVAL,
          },
        ]
      ),
    });
    expect(await screen.findByRole('cell', { name: 'Cardiology' })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /CARD/ })).toHaveTextContent('Active');
    await user.click(screen.getByRole('button', { name: 'Register department' }));
    const sheet = await screen.findByRole('dialog', { name: 'Register department' });
    await user.type(within(sheet).getByLabelText(/^Code/), 'neph');
    await user.type(within(sheet).getByLabelText(/^Name/), 'Nephrology');
    await user.click(within(sheet).getByLabelText('OPD'));
    await user.click(within(sheet).getByRole('button', { name: 'Add session Monday' }));
    const end = within(sheet).getByLabelText('Monday session 1 ends');
    await user.clear(end);
    await user.type(end, '08:00');
    await user.click(within(sheet).getByRole('button', { name: 'Submit for approval' }));
    expect(await within(sheet).findByText('End after start')).toBeInTheDocument();
    await user.clear(end);
    await user.type(end, '14:00');
    await user.click(
      within(sheet).getByRole('button', { name: 'Copy Monday to Tuesday–Saturday' }),
    );
    await user.click(within(sheet).getByRole('button', { name: 'Submit for approval' }));
    expect(
      await screen.findByText(/Nephrology \(NEPH\) was sent for approval\./),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View request/ })).toHaveAttribute(
      'href',
      `/approvals?box=mine&id=${APPROVAL}`,
    );
    expect(body).toMatchObject({
      code: 'NEPH',
      name: 'Nephrology',
      type: 'CLINICAL',
      location: { branchId: BRANCH.id },
      services: { opd: true, ipd: false, procedures: false, diagnostics: false },
    });
    expect(body.opdTimings).toHaveLength(6);
    expect(body.opdTimings[0]).toEqual({ day: 1, from: '09:00', to: '14:00' });
    expect(body).not.toHaveProperty('parentId');
  });

  it('lists what still uses a department when closing it (409 DEPARTMENT_IN_USE)', async () => {
    let closeBody;
    const { user } = setup({
      [`GET /departments/${DEPT.id}`]: () => [200, DEPT],
      [`POST /departments/${DEPT.id}/close`]: (_req, b) => (
        (closeBody = b),
        [
          409,
          errorBody('DEPARTMENT_IN_USE', 'Move these first', {
            details: [{ path: 'department', message: '4 active staff member(s) belong to it' }],
          }),
        ]
      ),
    });
    await user.click(await screen.findByRole('cell', { name: 'Cardiology' }));
    const sheet = await screen.findByRole('dialog', { name: 'Edit Cardiology' });
    expect(within(sheet).getByLabelText(/^Code/)).toHaveAttribute('readonly');
    await user.click(within(sheet).getByRole('button', { name: 'Close department' }));
    const confirm = await screen.findByRole('alertdialog', { name: 'Close Cardiology?' });
    await user.type(within(confirm).getByRole('textbox'), 'Merged into medicine');
    await user.click(within(confirm).getByRole('button', { name: 'Request closure' }));
    const alert = await within(sheet).findByRole('alert');
    expect(alert).toHaveTextContent('4 active staff member(s) belong to it');
    expect(closeBody).toEqual({ version: 2, reason: 'Merged into medicine' });
  });

  it('filters by status and search', async () => {
    const { user, fetchMock } = setup();
    await screen.findByRole('cell', { name: 'Cardiology' });
    await user.selectOptions(screen.getByLabelText('Status'), 'PENDING_APPROVAL');
    await user.type(screen.getByLabelText('Search'), 'neph');
    await waitFor(() => {
      const urls = fetchMock.mock.calls
        .map(([r]) => r.url)
        .filter((u) => u.includes('/departments?'));
      expect(urls.at(-1)).toMatch(/status=PENDING_APPROVAL/);
      expect(urls.at(-1)).toMatch(/q=neph/);
    });
  });
});

describe('Generated master forms', () => {
  it('reads field kinds from the shared schema', () => {
    expect(masterFields('payment-modes').map((f) => [f.name, f.kind, f.required])).toEqual([
      ['code', 'text', true],
      ['name', 'text', true],
      ['kind', 'enum', true],
      ['requiresReference', 'boolean', false],
    ]);
    expect(masterFields('holidays').find((f) => f.name === 'branchCodes').kind).toBe('list');
    expect(masterFields('referral-sources').find((f) => f.name === 'phone')).toMatchObject({
      kind: 'text',
      required: false,
    });
    expect(masterFields('units').find((f) => f.name === 'factor')).toMatchObject({
      kind: 'number',
      defaultValue: 1,
    });
  });

  it('adds a referral source from the generated form', async () => {
    let body;
    const { user } = setup(
      {
        'GET /masters/referral-sources': () => [200, page([])],
        'POST /masters/referral-sources': (_req, b) => (
          (body = b),
          [201, { item: { ...b, id: 'r1' } }]
        ),
      },
      '/settings/masters?tab=referral-sources',
    );
    expect(await screen.findByText('Referral sources: nothing here yet')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add to Referral sources' }));
    const sheet = await screen.findByRole('dialog', { name: 'Add to Referral sources' });
    await user.type(within(sheet).getByLabelText(/^Code/), 'camp1');
    await user.type(within(sheet).getByLabelText(/^Name/), 'Health camp Pune');
    await user.selectOptions(within(sheet).getByLabelText(/^Kind/), 'CAMP');
    await user.click(within(sheet).getByRole('button', { name: 'Add' }));
    await screen.findByText('Health camp Pune added');
    expect(body).toEqual({ code: 'CAMP1', name: 'Health camp Pune', kind: 'CAMP' });
  });

  it('shows current and pending rates of a service', async () => {
    setup(
      {
        'GET /masters/services': () => [
          200,
          page([
            {
              id: 's1',
              code: 'CONS-GEN',
              name: 'General consultation',
              category: 'CONSULTATION',
              taxCodeId: 't1',
              rates: [{ priceListId: 'p1', amount: 50000 }],
              pendingRates: [{ priceListId: 'p1', amount: 60000 }],
              status: 'ACTIVE',
              isActive: true,
              version: 1,
            },
          ]),
        ],
        'GET /masters/price-lists': () => [
          200,
          page([{ id: 'p1', code: 'GENERAL', name: 'General', isActive: true, isDefault: true }]),
        ],
        'GET /masters/tax-codes': () => [
          200,
          page([{ id: 't1', code: 'EXEMPT', name: 'Exempt', isActive: true }]),
        ],
      },
      '/settings/masters?tab=services',
    );
    const row = await screen.findByRole('row', { name: /CONS-GEN/ });
    await waitFor(() => expect(row).toHaveTextContent('GENERAL ₹500'));
    expect(row).toHaveTextContent('New rates waiting for approval: GENERAL ₹600');
    expect(row).toHaveTextContent('Active');
  });
});

describe('Import wizard', () => {
  const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  it('uploads, previews errors, and saves only a clean file with a reason', async () => {
    const commits = [];
    let preview = 'errors';
    const { user } = setup(
      {
        'GET /masters/referral-sources': () => [200, page([])],
        'POST /files/upload-url': (_req, b) => [
          201,
          {
            fileId: 'f'.repeat(24),
            upload: {
              method: 'PUT',
              url: '/api/files/local/tok',
              headers: { 'Content-Type': b.mime },
            },
          },
        ],
        'PUT /api/files/local/tok': () => [200, undefined],
        [`POST /files/${'f'.repeat(24)}/complete`]: () => [
          200,
          { id: 'f'.repeat(24), status: 'READY' },
        ],
        'POST /masters/referral-sources/import': (_req, b) => {
          if (b.commit) {
            commits.push(b);
            return [
              200,
              { summary: { rows: 2, new: 2, update: 0, error: 0 }, approvalId: null, items: [] },
            ];
          }
          return preview === 'errors'
            ? [
                200,
                {
                  summary: { rows: 2, new: 1, update: 0, error: 1 },
                  rows: [
                    { row: 2, status: 'NEW', code: 'RS1', name: 'One' },
                    {
                      row: 3,
                      status: 'ERROR',
                      code: 'RS2',
                      errors: [{ path: 'kind', message: 'Invalid option' }],
                    },
                  ],
                },
              ]
            : [
                200,
                {
                  summary: { rows: 2, new: 2, update: 0, error: 0 },
                  rows: [
                    { row: 2, status: 'NEW', code: 'RS1', name: 'One' },
                    { row: 3, status: 'NEW', code: 'RS2', name: 'Two' },
                  ],
                },
              ];
        },
      },
      '/settings/masters?tab=referral-sources',
    );
    await user.click(await screen.findByRole('button', { name: 'Import from Excel' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Import Referral sources from Excel',
    });
    await user.click(within(dialog).getByRole('button', { name: 'I have the file' }));
    const input = dialog.querySelector('input[type=file]');

    // The picker only offers .xlsx and .csv; a dropped or forced file is still checked.
    await userEvent
      .setup({ applyAccept: false })
      .upload(input, new File(['x'], 'notes.txt', { type: 'text/plain' }));
    expect(await within(dialog).findByText(/This type of file is not allowed/)).toBeInTheDocument();

    await user.upload(input, new File(['Code,Name\nRS1,One'], 'refs.csv', { type: 'text/csv' }));
    expect(await within(dialog).findByText('1 row(s) have errors.')).toBeInTheDocument();
    expect(within(dialog).getByRole('row', { name: /RS2/ })).toHaveTextContent(
      'kind Invalid option',
    );
    expect(within(dialog).getByRole('button', { name: 'Continue' })).toBeDisabled();

    preview = 'clean';
    await user.click(within(dialog).getByRole('button', { name: 'Upload another file' }));
    await user.upload(
      dialog.querySelector('input[type=file]'),
      new File(['ok'], 'refs.xlsx', { type: XLSX }),
    );
    await within(dialog).findByText('Checked refs.xlsx.');
    await user.click(within(dialog).getByRole('button', { name: 'Continue' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save 2 rows' }));
    expect(
      await within(dialog).findByText('Enter a reason. It is saved in the audit log.'),
    ).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/^Reason/), 'New referral list');
    await user.click(within(dialog).getByRole('button', { name: 'Save 2 rows' }));
    expect(await within(dialog).findByText('2 rows saved to Referral sources')).toBeInTheDocument();
    expect(commits).toEqual([
      { fileId: 'f'.repeat(24), commit: true, reason: 'New referral list' },
    ]);
  });
});

describe('Number examples', () => {
  it('formats the next number like the API', () => {
    expect(exampleNumber({ prefix: 'CC', reset: 'NEVER', width: 7 })).toBe('CC0000001');
    expect(exampleNumber({ prefix: 'op', reset: 'YEARLY', width: 6 })).toMatch(
      /^OP\/\d{2}-\d{2}\/000001$/,
    );
    expect(exampleNumber({ prefix: 'OP', reset: 'YEARLY', width: 12 })).toBeNull();
  });
});
