import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { errorBody, makeSession } from '../../test/fixtures.js';
import { mockApi, renderApp } from '../../test/renderApp.jsx';

const SETTINGS = {
  displayName: 'Demo Hospital',
  financialYearStartMonth: 4,
  timezone: 'Asia/Kolkata',
  dateFormat: 'DD/MM/YYYY',
  languages: ['en', 'hi'],
  communication: {},
  version: 3,
  idleTimeoutMin: 15,
};

const BRANCHES = [
  {
    id: '64b000000000000000000001',
    name: 'Main Branch',
    code: 'MAIN',
    status: 'ACTIVE',
    version: 0,
  },
];

function setup(handlers = {}, { panel = 'superadmin', path = '/settings' } = {}) {
  const session = makeSession({ panel });
  const fetchMock = mockApi({
    'GET /auth/me': () => [200, session],
    'GET /settings/hospital': () => [200, SETTINGS],
    'GET /settings/entities': () => [200, []],
    'GET /branches': () => [200, BRANCHES],
    ...handlers,
  });
  const utils = renderApp(path);
  return { ...utils, fetchMock, user: userEvent.setup() };
}

const calls = (fetchMock, method, path) =>
  fetchMock.mock.calls.filter(
    ([req]) => req.method === method && new URL(req.url).pathname.endsWith(path),
  );

describe('Hospital settings', () => {
  it('saves the profile with the version it read and an idempotency key', async () => {
    let body;
    const { user, fetchMock } = setup({
      'PUT /settings/hospital': (_req, b) => ((body = b), [200, { ...SETTINGS, ...b, version: 4 }]),
    });
    const name = await screen.findByLabelText(/^Display name/);
    await waitFor(() => expect(name).toHaveValue('Demo Hospital'));
    await user.clear(name);
    await user.type(name, 'Demo Multispeciality Hospital');
    await user.clear(screen.getByLabelText(/^Sign out after inactivity/));
    await user.type(screen.getByLabelText(/^Sign out after inactivity/), '20');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByText('Settings saved');
    expect(body).toMatchObject({
      displayName: 'Demo Multispeciality Hospital',
      idleTimeoutMin: 20,
      languages: ['en', 'hi'],
      version: 3,
    });
    const [req] = calls(fetchMock, 'PUT', '/settings/hospital')[0];
    expect(req.headers.get('Idempotency-Key')).toBeTruthy();
  });

  it('checks the idle timeout range before saving', async () => {
    const { user, fetchMock } = setup();
    const idle = await screen.findByLabelText(/^Sign out after inactivity/);
    await waitFor(() => expect(idle).toHaveValue(15));
    await user.clear(idle);
    await user.type(idle, '90');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(
      await screen.findByText('Enter a whole number of minutes from 5 to 60.'),
    ).toBeInTheDocument();
    expect(calls(fetchMock, 'PUT', '/settings/hospital')).toHaveLength(0);
  });

  it('on 409 offers Reload, which keeps the edit and takes the new version', async () => {
    let version = 3;
    let body;
    const { user } = setup({
      'GET /settings/hospital': () => [
        200,
        { ...SETTINGS, version, dateFormat: version > 3 ? 'DD-MMM-YYYY' : 'DD/MM/YYYY' },
      ],
      'PUT /settings/hospital': (_req, b) => {
        body = b;
        if (b.version !== version)
          return [409, errorBody('VERSION_CONFLICT', 'Changed by someone else')];
        return [200, { ...SETTINGS, ...b, version: version + 1 }];
      },
    });
    const name = await screen.findByLabelText(/^Display name/);
    await waitFor(() => expect(name).toHaveValue('Demo Hospital'));
    version = 4; // someone else saved meanwhile
    await user.clear(name);
    await user.type(name, 'Mine');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Someone else changed this record');
    await user.click(within(alert).getByRole('button', { name: 'Reload' }));
    await waitFor(() => expect(screen.getByLabelText(/^Date format/)).toHaveValue('DD-MMM-YYYY'));
    expect(screen.getByLabelText(/^Display name/)).toHaveValue('Mine');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByText('Settings saved');
    expect(body).toMatchObject({ displayName: 'Mine', version: 4, dateFormat: 'DD-MMM-YYYY' });
  });

  it('is read-only without the update permission', async () => {
    setup({}, { panel: 'auditor' });
    // Auditors have no settings permission at all: the screen is a 403.
    expect(
      await screen.findByRole('heading', { name: "You don't have access to Hospital settings" }),
    ).toBeInTheDocument();
  });

  it('keeps the tab in the URL', async () => {
    const { user, router } = setup();
    await user.click(await screen.findByRole('tab', { name: 'Branches' }));
    await waitFor(() => expect(router.state.location.search).toBe('?tab=branches'));
    expect(await screen.findByRole('cell', { name: 'Main Branch' })).toBeInTheDocument();
  });
});

describe('Branches', () => {
  it('shows the plan limit (402) with a link to Subscription', async () => {
    const { user } = setup(
      {
        'POST /branches': () => [
          402,
          errorBody(
            'LIMIT_REACHED',
            'Your plan allows 1 branch. Add branches to your subscription first.',
          ),
        ],
      },
      { path: '/settings?tab=branches' },
    );
    await user.click(await screen.findByRole('button', { name: 'Open a branch' }));
    const sheet = await screen.findByRole('dialog', { name: 'Open a branch' });
    await user.type(within(sheet).getByLabelText(/^Branch name/), 'North Branch');
    await user.type(within(sheet).getByLabelText(/^Branch code/), 'north');
    await user.click(within(sheet).getByRole('button', { name: 'Submit for approval' }));
    const alert = await within(sheet).findByRole('alert');
    expect(alert).toHaveTextContent('Your plan limit is reached.');
    expect(alert).toHaveTextContent('Your plan allows 1 branch.');
    expect(within(alert).getByRole('link', { name: /Open Subscription/ })).toHaveAttribute(
      'href',
      '/settings/subscription',
    );
  });

  it('sends a new branch for approval (202) and links to the request', async () => {
    let body;
    const { user } = setup(
      {
        'POST /branches': (_req, b) => (
          (body = b),
          [
            202,
            { branch: { ...b, id: 'b2', status: 'PENDING_APPROVAL' }, approvalId: 'a'.repeat(24) },
          ]
        ),
      },
      { path: '/settings?tab=branches' },
    );
    await user.click(await screen.findByRole('button', { name: 'Open a branch' }));
    const sheet = await screen.findByRole('dialog', { name: 'Open a branch' });
    await user.type(within(sheet).getByLabelText(/^Branch name/), 'North Branch');
    await user.type(within(sheet).getByLabelText(/^Branch code/), 'north');
    await user.type(within(sheet).getByLabelText(/^Note for the approver/), 'Second site');
    await user.click(within(sheet).getByRole('button', { name: 'Submit for approval' }));
    expect(
      await screen.findByText(/Branch North Branch was sent for approval\./),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View request/ })).toHaveAttribute(
      'href',
      `/approvals?box=mine&id=${'a'.repeat(24)}`,
    );
    expect(body).toMatchObject({ name: 'North Branch', code: 'NORTH', reason: 'Second site' });
    expect(body).not.toHaveProperty('entityId');
  });

  it('lists what blocks closing a branch (409 BRANCH_IN_USE)', async () => {
    const { user } = setup(
      {
        'POST /branches/64b000000000000000000001/close': () => [
          409,
          errorBody('BRANCH_IN_USE', 'This branch cannot be closed yet', {
            details: [
              { path: 'branch', message: 'It is the only active branch' },
              {
                path: 'branch',
                message: '3 active user(s) work only in this branch; move them first',
              },
            ],
          }),
        ],
      },
      { path: '/settings?tab=branches' },
    );
    await user.click(await screen.findByRole('button', { name: 'Close branch Main Branch' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Close branch Main Branch?' });
    await user.click(within(dialog).getByRole('button', { name: 'Request closure' }));
    expect(
      await within(dialog).findByText('Enter a reason. It is saved in the audit log.'),
    ).toBeInTheDocument();
    await user.type(within(dialog).getByRole('textbox'), 'Merging with main');
    await user.click(within(dialog).getByRole('button', { name: 'Request closure' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('This cannot be done yet.');
    expect(
      within(alert)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual([
      'It is the only active branch',
      '3 active user(s) work only in this branch; move them first',
    ]);
  });
});

describe('Number series', () => {
  const SERIES = [
    {
      series: 'UHID',
      label: 'Patient UHID',
      perBranch: false,
      prefix: 'CC',
      reset: 'NEVER',
      width: 7,
    },
    {
      series: 'OP_BILL',
      label: 'OPD bill',
      perBranch: true,
      prefix: 'OP',
      reset: 'YEARLY',
      width: 6,
    },
  ];

  it('shows a live example and locks the UHID reset', async () => {
    let body;
    const { user } = setup(
      {
        'GET /settings/number-series': () => [200, SERIES],
        'PUT /settings/number-series/OP_BILL': (_req, b) => (
          (body = b),
          [200, { ...SERIES[1], ...b }]
        ),
      },
      { path: '/settings?tab=numbering' },
    );
    expect(await screen.findByText('CC0000001')).toBeInTheDocument();
    expect(screen.getByText('Never (permanent ID)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Reset period for Patient UHID')).not.toBeInTheDocument();
    const prefix = screen.getByLabelText('Prefix for OPD bill');
    await user.clear(prefix);
    await user.type(prefix, 'opb');
    await user.selectOptions(screen.getByLabelText('Reset period for OPD bill'), 'MONTHLY');
    expect(screen.getByText(/^OPB\/\d{4}\/000001$/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save OPD bill' }));
    await screen.findByText('OPD bill numbering saved');
    expect(body).toEqual({ prefix: 'OPB', reset: 'MONTHLY', width: 6 });
  });
});

describe('Approval rules', () => {
  it('edits thresholds in rupees and sends paise', async () => {
    let body;
    const RULE = {
      action: 'billing.discount',
      label: 'Bill discount',
      levels: [
        { label: 'Billing Manager', permission: 'approvals:billing-discount:l1' },
        {
          label: 'Super Admin',
          permission: 'approvals:billing-discount:l2',
          when: { amountOver: 1000000, percentOver: 10 },
        },
      ],
      expiryHours: 48,
      enabled: true,
      version: 2,
    };
    const { user } = setup(
      {
        'GET /approval-rules': () => [200, [RULE]],
        'PUT /approval-rules/billing.discount': (_req, b) => (
          (body = b),
          [200, { ...RULE, version: 3 }]
        ),
      },
      { path: '/settings?tab=approval-rules' },
    );
    expect(
      await screen.findByText('L2 Super Admin, when over ₹10,000 or over 10%'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Edit Bill discount' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit rule: Bill discount' });
    expect(within(dialog).getByLabelText('Amount over')).toHaveValue('10000');
    await user.clear(within(dialog).getByLabelText('Amount over'));
    await user.type(within(dialog).getByLabelText('Amount over'), '25000.50');
    await user.clear(within(dialog).getByLabelText(/^Expires after/));
    await user.type(within(dialog).getByLabelText(/^Expires after/), '24');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await screen.findByText('Rule “Bill discount” saved');
    expect(body).toEqual({
      version: 2,
      expiryHours: 24,
      enabled: true,
      thresholds: [null, { amountOver: 2500050, percentOver: 10 }],
    });
  });
});
