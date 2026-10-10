import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ROLE_GRANTS } from '@hms/shared';
import { errorBody, makeSession } from '../../test/fixtures.js';
import { mockApi, renderApp } from '../../test/renderApp.jsx';
import { generatePassword } from './password.js';
import { editorGroups, permissionDiff } from './roles.js';

const BRANCH = {
  id: '64b000000000000000000001',
  name: 'Main Branch',
  code: 'MAIN',
  status: 'ACTIVE',
  version: 0,
};
const ROLES = [
  {
    id: 'r1',
    code: 'nurse',
    name: 'Staff Nurse',
    isSystem: true,
    status: 'ACTIVE',
    permissions: ['nursing:*'],
    scope: 'ward',
    userCount: 3,
    version: 0,
  },
  {
    id: 'r2',
    code: 'billingmgr',
    name: 'Billing Manager',
    isSystem: true,
    status: 'ACTIVE',
    permissions: ['billing:*'],
    scope: 'branch',
    userCount: 1,
    version: 0,
  },
  {
    id: 'r3',
    code: 'senior-nurse',
    name: 'Senior Nurse',
    isSystem: false,
    clonedFrom: 'nurse',
    status: 'ACTIVE',
    permissions: ['nursing:*', 'lab:sample:read'],
    scope: 'ward',
    maxSessions: null,
    userCount: 0,
    version: 5,
  },
];
const CATALOG = [
  { module: 'NUR', name: 'Nursing', permissions: ['nursing:*'] },
  {
    module: 'LAB',
    name: 'Laboratory',
    permissions: ['approvals:lab-result-release:l1', 'lab:*', 'lab:result:read', 'lab:sample:read'],
  },
];
const NURSE = {
  id: 'u'.repeat(24),
  name: 'Anjali Menon',
  username: 'anjali.menon',
  status: 'LOCKED',
  lockedUntil: new Date(Date.now() + 600_000).toISOString(),
  roles: [{ id: 'r1', code: 'nurse', name: 'Staff Nurse' }],
  pendingRoleCodes: ['billingmgr'],
  branchIds: [BRANCH.id],
  departmentIds: [],
  preferredLanguage: 'en',
  twoFactorEnabled: false,
  mustChangePassword: false,
  version: 7,
};

function setup(handlers = {}, path = '/settings/users') {
  const fetchMock = mockApi({
    'GET /auth/me': () => [200, makeSession({ panel: 'admin', permissions: ROLE_GRANTS.admin })],
    'GET /branches': () => [200, [BRANCH]],
    'GET /departments': () => [200, { items: [], page: 1, limit: 100, total: 0 }],
    'GET /roles': () => [200, ROLES],
    'GET /roles/permissions': () => [200, CATALOG],
    'GET /users': () => [200, { items: [NURSE], page: 1, limit: 25, total: 1 }],
    ...handlers,
  });
  return { ...renderApp(path), fetchMock, user: userEvent.setup() };
}

describe('Users', () => {
  it('lists users with current and pending roles', async () => {
    setup();
    const row = await screen.findByRole('row', { name: /Anjali Menon/ });
    expect(row).toHaveTextContent('Staff Nurse');
    expect(row).toHaveTextContent('Waiting for approval: Billing Manager');
    expect(row).toHaveTextContent('Locked');
  });

  it('creates a login with a temporary password (201)', async () => {
    let body;
    const { user } = setup({
      'POST /users': (_req, b) => (
        (body = b),
        [201, { user: { ...NURSE, id: 'n2' }, approvalId: null }]
      ),
    });
    await user.click(await screen.findByRole('button', { name: 'Add user', exact: true }));
    const sheet = await screen.findByRole('dialog', { name: 'Add user' });
    await user.type(within(sheet).getByLabelText(/^Full name/), 'Priya Nair');
    await user.type(within(sheet).getByLabelText(/^Username/), 'priya.nair');
    await user.click(within(sheet).getByRole('button', { name: 'Create login' }));
    expect(await within(sheet).findByText('Give at least one role')).toBeInTheDocument();
    await user.click(within(sheet).getByLabelText('Staff Nurse'));
    await user.click(within(sheet).getByLabelText('Main Branch'));
    await user.type(
      within(sheet).getByRole('textbox', { name: 'Temporary password' }),
      'Priya#Temp2026',
    );
    await user.click(within(sheet).getByRole('button', { name: 'Create login' }));
    await screen.findByText('Login created for Priya Nair');
    expect(body).toEqual({
      name: 'Priya Nair',
      username: 'priya.nair',
      roleCodes: ['nurse'],
      branchIds: [BRANCH.id],
      departmentIds: [],
      preferredLanguage: 'en',
      onboarding: { mode: 'TEMP_PASSWORD', temporaryPassword: 'Priya#Temp2026' },
    });
  });

  it('needs a mobile for an invitation and says a privileged role waits for approval (202)', async () => {
    let body;
    const { user } = setup({
      'POST /users': (_req, b) => (
        (body = b),
        [202, { user: { ...NURSE, id: 'n3' }, approvalId: 'a'.repeat(24) }]
      ),
    });
    await user.click(await screen.findByRole('button', { name: 'Add user', exact: true }));
    const sheet = await screen.findByRole('dialog', { name: 'Add user' });
    await user.type(within(sheet).getByLabelText(/^Full name/), 'Rahul Mehta');
    await user.type(within(sheet).getByLabelText(/^Username/), 'rahul.mehta');
    await user.click(within(sheet).getByLabelText(/Billing Manager/));
    expect(within(sheet).getByText(/Billing Manager: a privileged role/)).toBeInTheDocument();
    await user.click(within(sheet).getByLabelText('Main Branch'));
    await user.click(within(sheet).getByRole('radio', { name: /Invitation by SMS/ }));
    await user.click(within(sheet).getByRole('button', { name: 'Submit for approval' }));
    expect(
      await within(sheet).findByText('An invitation is sent by SMS: enter the mobile number'),
    ).toBeInTheDocument();
    await user.type(within(sheet).getByLabelText(/^Mobile/), '98765 43210');
    await user.click(within(sheet).getByRole('button', { name: 'Submit for approval' }));
    expect(
      await screen.findByText(/The login for Rahul Mehta was sent for approval\./),
    ).toBeInTheDocument();
    expect(body).toMatchObject({
      mobile: '9876543210',
      roleCodes: ['billingmgr'],
      onboarding: { mode: 'INVITE' },
    });
  });

  it('unlocks, and deactivating needs a reason (409 LAST_SUPER_ADMIN shown)', async () => {
    const calls = [];
    const { user } = setup({
      [`POST /users/${NURSE.id}/unlock`]: () => (calls.push('unlock'), [200, NURSE]),
      [`POST /users/${NURSE.id}/deactivate`]: (_req, b) => (
        calls.push(b),
        [409, errorBody('LAST_SUPER_ADMIN', 'The last Super Admin cannot be deactivated')]
      ),
    });
    await user.click(await screen.findByRole('button', { name: 'Actions for Anjali Menon' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Unlock' }));
    await screen.findByText('Anjali Menon is unlocked');
    await user.click(screen.getByRole('button', { name: 'Actions for Anjali Menon' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Deactivate' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Deactivate Anjali Menon?' });
    await user.type(within(dialog).getByRole('textbox'), 'Left the hospital');
    await user.click(within(dialog).getByRole('button', { name: 'Deactivate' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The last Super Admin cannot be deactivated',
    );
    expect(calls).toEqual(['unlock', { version: 7, reason: 'Left the hospital' }]);
  });

  it('resets a password with a policy-compliant temporary password', async () => {
    let body;
    const { user } = setup({
      [`POST /users/${NURSE.id}/reset-password`]: (_req, b) => ((body = b), [200, NURSE]),
    });
    await user.click(await screen.findByRole('button', { name: 'Actions for Anjali Menon' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Reset password' }));
    const dialog = await screen.findByRole('dialog', { name: 'Reset password for Anjali Menon' });
    const input = within(dialog).getByRole('textbox', { name: 'Temporary password' });
    await user.clear(input);
    await user.type(input, 'weak');
    await user.click(within(dialog).getByRole('button', { name: 'Set temporary password' }));
    expect(within(dialog).getByText('Use at least 10 characters')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Generate' }));
    await user.click(within(dialog).getByRole('button', { name: 'Set temporary password' }));
    await screen.findByText('Temporary password set for Anjali Menon');
    expect(body.temporaryPassword).toMatch(/^.{12}$/);
  });
});

describe('Roles', () => {
  it('shows a system role read-only with "Copy into a custom role"', async () => {
    const { user } = setup({}, '/settings/roles');
    const editor = (await screen.findByRole('heading', { name: 'Staff Nurse', level: 2 })).closest(
      'section',
    );
    expect(editor).toHaveTextContent('System role · read-only');
    expect(within(editor).getByText('nursing:*')).toBeInTheDocument();
    expect(within(editor).queryByRole('checkbox')).not.toBeInTheDocument();
    await user.click(within(editor).getByRole('button', { name: 'Copy into a custom role' }));
    expect(
      await screen.findByRole('heading', { name: 'New custom role', level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^Role name/)).toHaveValue('Staff Nurse (custom)');
  });

  it('reviews added and removed permissions before sending the change for approval (202)', async () => {
    let body;
    const { user } = setup(
      {
        'PUT /roles/r3': (_req, b) => (
          (body = b),
          [202, { role: ROLES[2], approvalId: 'b'.repeat(24) }]
        ),
      },
      '/settings/roles?role=r3',
    );
    await screen.findByRole('heading', { name: 'Senior Nurse', level: 2 });
    await user.click(screen.getByRole('checkbox', { name: /^lab:sample:read/ }));
    await user.click(screen.getByRole('checkbox', { name: /Everything in lab/ }));
    expect(screen.getByRole('checkbox', { name: /^lab:result:read/ })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /^lab:result:read/ })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Review and submit' }));
    const dialog = await screen.findByRole('dialog', { name: 'Review changes to Senior Nurse' });
    expect(within(dialog).getByText('Added (1)')).toBeInTheDocument();
    expect(within(dialog).getByText('Removed (1)')).toBeInTheDocument();
    expect(dialog).toHaveTextContent('addedlab:*');
    expect(dialog).toHaveTextContent('removedlab:sample:read');
    await user.type(within(dialog).getByLabelText(/^Note for the approver/), 'Ward sampling');
    await user.click(within(dialog).getByRole('button', { name: 'Submit for approval' }));
    expect(
      await screen.findByText(/The permission change for Senior Nurse was sent for approval\./),
    ).toBeInTheDocument();
    expect(body).toEqual({
      name: 'Senior Nurse',
      permissions: ['lab:*', 'nursing:*'],
      scope: 'ward',
      maxSessions: null,
      version: 5,
      reason: 'Ward sampling',
    });
  });

  it('explains ROLE_IN_USE when deactivating', async () => {
    const { user } = setup(
      {
        'POST /roles/r3/deactivate': () => [
          409,
          errorBody('ROLE_IN_USE', '2 user(s) still have this role'),
        ],
      },
      '/settings/roles?role=r3',
    );
    await screen.findByRole('heading', { name: 'Senior Nurse', level: 2 });
    await user.click(screen.getByRole('button', { name: 'Deactivate' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Deactivate Senior Nurse?' });
    await user.click(within(dialog).getByRole('button', { name: 'Deactivate' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('2 user(s) still have this role'),
    );
  });
});

describe('role helpers', () => {
  it('generates passwords that meet the policy', () => {
    for (let i = 0; i < 20; i++) {
      const p = generatePassword();
      expect(p).toHaveLength(12);
      expect([/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].every((re) => re.test(p))).toBe(true);
    }
  });

  it('builds editor groups and diffs', () => {
    const [nur, lab] = editorGroups(CATALOG);
    expect(nur.heads).toEqual(['nursing']);
    expect(nur.keys).toEqual([]);
    expect(lab.heads).toEqual(['lab']);
    expect(lab.keys).toEqual([
      'approvals:lab-result-release:l1',
      'lab:result:read',
      'lab:sample:read',
    ]);
    expect(permissionDiff(['a', 'b'], ['b', 'c'])).toEqual({ added: ['c'], removed: ['a'] });
  });
});
