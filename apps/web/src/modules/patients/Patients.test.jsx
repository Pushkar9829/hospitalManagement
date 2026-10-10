import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ROLE_GRANTS, estimatedDob } from '@hms/shared';
import { errorBody, makeSession } from '../../test/fixtures.js';
import { mockApi, renderApp } from '../../test/renderApp.jsx';
import { emptyForm, fromPatient, prefillFromSearch, searchHint, toPayload } from './patientForm.js';

// Typing whole forms takes a few seconds under a parallel run.
vi.setConfig({ testTimeout: 30_000 });

const ID = 'a'.repeat(24);
const OTHER = 'b'.repeat(24);
const dob = (years) => estimatedDob({ years }).toISOString();

const PATIENT = {
  id: ID,
  uhid: 'CC0000123',
  name: { first: 'Ravi', last: 'Kumar', full: 'Ravi Kumar' },
  gender: 'M',
  dob: dob(64),
  dobEstimated: true,
  age: '64Y',
  bloodGroup: 'B+',
  mobile: '9876543210',
  ids: [{ type: 'AADHAAR', number: 'XXXX XXXX 4321' }],
  allergies: [{ substance: 'Penicillin', severity: 'SEVERE' }],
  noKnownAllergies: false,
  chronicConditions: ['Hypertension'],
  flags: { vip: false, mlc: true },
  category: 'SENIOR',
  preferredLanguage: 'hi',
  registrationType: 'FULL',
  toComplete: ['address'],
  status: 'ACTIVE',
  registeredAt: '2026-10-01T05:00:00.000Z',
  version: 3,
};
const CARD = {
  id: ID,
  uhid: 'CC0000123',
  name: 'Ravi Kumar',
  gender: 'M',
  age: '64Y',
  mobile: '9876543210',
  allergies: ['Penicillin'],
  flags: { vip: false, mlc: true },
  status: 'ACTIVE',
};

function setup(handlers = {}, path = '/patients', panel = 'frontoffice') {
  const fetchMock = mockApi({
    'GET /auth/me': () => [
      200,
      makeSession({ panel, permissions: [...ROLE_GRANTS[panel], 'myspace:*'] }),
    ],
    'GET /patients': () => [200, { items: [CARD], page: 1, limit: 20, total: 1 }],
    [`GET /patients/${ID}`]: () => [200, PATIENT],
    [`GET /patients/${ID}/timeline`]: () => [
      200,
      [
        { at: '2026-10-02T06:30:00.000Z', type: 'BILL', title: 'Bill OP/26-27/000001', ref: OTHER },
        { at: '2026-10-01T05:00:00.000Z', type: 'REGISTERED', title: 'Registered as CC0000123' },
      ],
    ],
    ...handlers,
  });
  return { ...renderApp(path), fetchMock, user: userEvent.setup() };
}

describe('patient form helpers', () => {
  it('turns an age into the API birth shape and drops empty sections', () => {
    const v = emptyForm({ registrationType: 'QUICK', prefill: prefillFromSearch('Ravi Kumar') });
    const body = toPayload({ ...v, gender: 'M', mobile: '9876543210', age: { years: '47' } });
    expect(body).toMatchObject({
      registrationType: 'QUICK',
      name: { first: 'Ravi', last: 'Kumar' },
      birth: { age: { years: 47, months: 0, days: 0 } },
      category: 'GENERAL',
    });
    expect(body.address).toBeUndefined();
    expect(body.guardian).toBeUndefined();
    expect(prefillFromSearch('98765 43210')).toEqual({ mobile: '9876543210' });
  });

  it('reads a patient back with the Aadhaar still masked and the version', () => {
    const v = fromPatient(PATIENT);
    expect(v.ids[0].number).toBe('XXXX XXXX 4321');
    expect(v.birthMode).toBe('age');
    expect(v.version).toBe(3);
    expect(toPayload(v, 'edit')).toMatchObject({ version: 3, ids: [{ type: 'AADHAAR' }] });
  });

  it('asks for 4 digits of a mobile and 2 letters of a name', () => {
    expect(searchHint('987')).toBe('digits');
    expect(searchHint('r')).toBe('short');
    expect(searchHint('9876')).toBeNull();
    expect(searchHint('CC0000123')).toBeNull();
  });
});

describe('Patient search', () => {
  it('keeps the query in the URL and opens the profile from a row', async () => {
    const { user, router, fetchMock } = setup();
    const box = await screen.findByRole('searchbox', { name: 'Search' });
    await user.type(box, '987');
    expect(await screen.findByText('Type at least 4 digits of the mobile number.')).toBeVisible();
    await user.type(box, '6');
    const row = await screen.findByRole('row', { name: /Ravi Kumar/ });
    expect(row).toHaveTextContent('CC0000123');
    expect(row).toHaveTextContent('Medico-legal case');
    await waitFor(() => expect(router.state.location.search).toBe('?q=9876'));
    expect(fetchMock.mock.calls.some(([r]) => String(r.url ?? r).includes('q=9876'))).toBe(true);
    await user.click(row);
    await screen.findByRole('heading', { name: 'Ravi Kumar', level: 1 });
  });
});

describe('Registration', () => {
  it('validates with the shared schema, then registers (201) and opens the profile', async () => {
    let body;
    const { user, router } = setup(
      {
        'POST /patients': (req, b) => {
          body = b;
          expect(req.headers.get('Idempotency-Key')).toBeTruthy();
          return [201, PATIENT];
        },
      },
      '/patients/new?type=quick',
    );
    await user.click(await screen.findByRole('button', { name: 'Register' }));
    expect(await screen.findByText('Enter the first name')).toBeVisible();
    expect(screen.getByText('Choose the gender')).toBeVisible();
    await user.type(screen.getByLabelText(/^First name/), 'Ravi');
    await user.click(screen.getByLabelText('Male', { exact: true }));
    await user.type(screen.getByLabelText('Years'), '64');
    expect(screen.getByText('Senior citizen (60+)')).toBeVisible();
    await user.type(screen.getByLabelText(/^Mobile/), '9876543210');
    await user.click(screen.getByRole('button', { name: 'Register' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/patients/${ID}`));
    expect(body).toMatchObject({
      registrationType: 'QUICK',
      gender: 'M',
      mobile: '9876543210',
      birth: { age: { years: 64 } },
      confirmNotDuplicate: false,
    });
    expect(await screen.findByText('Registered with UHID CC0000123')).toBeInTheDocument();
  });

  it('shows possible duplicates with scores and registers anyway on confirmation', async () => {
    const bodies = [];
    const { user } = setup(
      {
        'POST /patients': (_req, b) => {
          bodies.push(b);
          if (!b.confirmNotDuplicate)
            return [
              409,
              errorBody('POSSIBLE_DUPLICATE', 'Similar patients are already registered.', {
                details: [{ path: 'patient', message: 'CC0000123', ...CARD, score: 0.91 }],
              }),
            ];
          return [201, { ...PATIENT, id: OTHER, uhid: 'CC0000124' }];
        },
      },
      '/patients/new?type=quick',
    );
    await user.type(await screen.findByLabelText(/^First name/), 'Ravi');
    await user.type(screen.getByLabelText(/^Last name/), 'Kumaar');
    await user.click(screen.getByLabelText('Male', { exact: true }));
    await user.type(screen.getByLabelText('Years'), '47');
    await user.type(screen.getByLabelText(/^Mobile/), '9876543210');
    await user.click(screen.getByRole('button', { name: 'Register' }));
    const alert = await screen.findByRole('alert', { name: '' });
    expect(alert).toHaveTextContent('Possible duplicate');
    const match = within(screen.getByRole('list', { name: 'Likely matches' })).getByRole(
      'listitem',
    );
    expect(match).toHaveTextContent('Ravi Kumar');
    expect(match).toHaveTextContent('Match 91%');
    expect(within(match).getByRole('link', { name: 'Open CC0000123' })).toHaveAttribute(
      'href',
      `/patients/${ID}`,
    );
    await user.click(screen.getByRole('button', { name: /register anyway/ }));
    await screen.findByText('Registered with UHID CC0000124');
    expect(bodies.map((b) => b.confirmNotDuplicate)).toEqual([false, true]);
  });

  it('masks Aadhaar after entry and needs a guardian under 18 (full registration)', async () => {
    const { user } = setup({}, '/patients/new');
    await user.type(await screen.findByLabelText(/^First name/), 'Asha');
    await user.click(screen.getByLabelText('Female', { exact: true }));
    await user.type(screen.getByLabelText('Years'), '9');
    await user.type(screen.getAllByLabelText(/^Mobile/)[0], '9876543210');
    await user.click(screen.getByRole('button', { name: 'Add ID document' }));
    const number = screen.getByLabelText(/^Number/);
    await user.type(number, '123456789012');
    await user.tab();
    expect(number).toHaveValue('XXXX XXXX 9012');
    expect(screen.getByText('Required: the patient is under 18')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Register' }));
    expect(
      await screen.findByText('Add a parent or guardian for a patient under 18'),
    ).toBeVisible();
  });
});

describe('Patient profile', () => {
  it('shows the banner, flags and the timeline in IST, tabs in the URL', async () => {
    const { user, router } = setup({}, `/patients/${ID}`);
    const banner = await screen.findByRole('region', { name: 'Patient: Ravi Kumar' });
    expect(banner).toHaveTextContent('64Y');
    expect(banner).toHaveTextContent('CC0000123');
    expect(banner).toHaveTextContent('Penicillin');
    expect(banner).toHaveTextContent('Senior citizen (60+)');
    expect(banner).toHaveTextContent('Medico-legal case');
    expect(await screen.findByText('Registered as CC0000123')).toBeVisible();
    expect(screen.getByText('2 Oct 2026, 12:00')).toBeVisible();
    await user.click(screen.getByRole('tab', { name: 'Details' }));
    expect(router.state.location.search).toBe('?tab=details');
    expect(screen.getByText('XXXX XXXX 4321')).toBeVisible();
  });

  it('saves an edit with the version and offers reload on 409', async () => {
    let body;
    const { user } = setup(
      {
        [`PUT /patients/${ID}`]: (_r, b) => {
          body = b;
          return [409, errorBody('VERSION_CONFLICT', 'Changed by someone else')];
        },
      },
      `/patients/${ID}`,
    );
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    const sheet = await screen.findByRole('dialog', { name: 'Edit Ravi Kumar' });
    await user.clear(within(sheet).getByLabelText(/^Last name/));
    await user.type(within(sheet).getByLabelText(/^Last name/), 'Kumar Rao');
    await user.click(within(sheet).getByRole('button', { name: 'Save' }));
    expect(await within(sheet).findByText('Someone else changed this record')).toBeVisible();
    expect(within(sheet).getByRole('button', { name: 'Reload' })).toBeVisible();
    expect(body).toMatchObject({ version: 3, name: { last: 'Kumar Rao' } });
    expect(body.ids[0].number).toBe('XXXX XXXX 4321');
  });

  it('sends a merge for approval (202) and says where it waits', async () => {
    let body;
    const { user } = setup(
      {
        'GET /patients': () => [
          200,
          {
            items: [CARD, { ...CARD, id: OTHER, uhid: 'CC0000077', name: 'Ravi Kumaar' }],
            total: 2,
          },
        ],
        'POST /patients/merge': (_r, b) => ((body = b), [202, { approvalId: 'c'.repeat(24) }]),
      },
      `/patients/${ID}`,
    );
    await user.click(await screen.findByRole('button', { name: 'Request merge' }));
    const dialog = await screen.findByRole('dialog', { name: /Merge CC0000123/ });
    await user.type(within(dialog).getByRole('searchbox'), 'ravi');
    await user.click(await within(dialog).findByRole('button', { name: /Ravi Kumaar/ }));
    await user.type(within(dialog).getByLabelText(/^Why are these/), 'Same Aadhaar and mobile');
    await user.click(within(dialog).getByRole('button', { name: 'Send for approval' }));
    expect(
      await screen.findByText(/The merge of CC0000077 into CC0000123 was sent for approval/),
    ).toBeVisible();
    expect(body).toEqual({ survivorId: ID, mergedId: OTHER, reason: 'Same Aadhaar and mobile' });
    expect(screen.getByRole('link', { name: /View request/ })).toHaveAttribute(
      'href',
      `/approvals?box=mine&id=${'c'.repeat(24)}`,
    );
  });

  it('sends a menu link with no id to the search', async () => {
    const { router } = setup({}, '/patients/:id');
    await waitFor(() => expect(router.state.location.pathname).toBe('/patients'));
  });
});
