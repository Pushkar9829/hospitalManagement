import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PRICE_BOOK } from '@hms/shared';
import { errorBody } from '../../test/fixtures.js';
import { mockApi, renderPublic } from '../../test/renderApp.jsx';
import { isMarketingHost } from '../../app/host.js';
import { suggestSubdomain } from './signup.js';

vi.setConfig({ testTimeout: 30_000 });

const PLANS = {
  version: 1,
  currency: 'INR',
  gstRate: 18,
  annualMonthsCharged: 10,
  trialDays: 14,
  plans: PRICE_BOOK.plans,
  modules: PRICE_BOOK.modules,
};

function setup(handlers = {}, path = '/pricing') {
  const fetchMock = mockApi({
    'GET /api/public/plans': () => [200, PLANS],
    ...handlers,
  });
  return { ...renderPublic(path), fetchMock, user: userEvent.setup() };
}

describe('hosts', () => {
  it('serves the public pages on the root domain and www, the staff app elsewhere', () => {
    expect(isMarketingHost('localhost')).toBe(true);
    expect(isMarketingHost('www.localhost')).toBe(true);
    expect(isMarketingHost('demo.localhost')).toBe(false);
    expect(suggestSubdomain("St. Mary's Hospital, Pune")).toBe('st-marys-hospital-pune');
  });
});

describe('Pricing', () => {
  it('lists plans with monthly and annual prices and never asks who is signed in', async () => {
    const { user, fetchMock } = setup();
    const hospital = (await screen.findByRole('heading', { name: 'Hospital' })).closest('li');
    expect(hospital).toHaveTextContent('₹35,000');
    expect(hospital).toHaveTextContent('Most chosen');
    await user.click(screen.getByRole('button', { name: 'Annual (2 months free)' }));
    expect(hospital).toHaveTextContent('₹3,50,000');
    expect(hospital).toHaveTextContent('a year');
    expect(within(hospital).getByRole('link', { name: 'Start 14-day trial' })).toHaveAttribute(
      'href',
      '/signup?plan=HOSPITAL',
    );
    expect(screen.getAllByText(/needs IPD and beds/)).toHaveLength(2);
    expect(fetchMock.mock.calls.some(([r]) => String(r.url ?? r).includes('/auth/me'))).toBe(false);
  });
});

describe('Signup wizard', () => {
  it('checks the address, verifies the mobile by OTP and starts the trial', async () => {
    let signup;
    const { user } = setup(
      {
        'GET /api/public/subdomains/sunrise-care': () => [200, { available: true }],
        'GET /api/public/subdomains/demo': () => [
          200,
          { available: false, reason: 'This address is taken' },
        ],
        'POST /api/public/signup/otp': () => [202, { expiresInSec: 300 }],
        'POST /api/public/signup/otp/verify': (_r, b) =>
          b.code === '123456'
            ? [200, { otpToken: 'otp_abcdefghijklmnop' }]
            : [401, errorBody('INVALID_CREDENTIALS', 'The code is incorrect')],
        'POST /api/public/signup': (_r, b) => (
          (signup = b),
          [
            202,
            {
              tenantId: 't1',
              status: 'TRIAL',
              loginUrl: 'http://sunrise-care.localhost:5173/welcome?token=abc',
              trialEndsAt: '2026-10-24T05:00:00.000Z',
            },
          ]
        ),
      },
      '/signup?plan=CLINIC',
    );
    await user.type(await screen.findByLabelText(/^Hospital or clinic name/), 'Sunrise Care');
    await user.type(screen.getByLabelText(/^City/), 'Pune');
    expect(screen.getByLabelText(/^Web address/)).toHaveValue('sunrise-care');
    expect(await screen.findByText('Available')).toBeVisible();
    await user.clear(screen.getByLabelText(/^Web address/));
    await user.type(screen.getByLabelText(/^Web address/), 'demo');
    expect(await screen.findByText('This address is taken')).toBeVisible();
    await user.clear(screen.getByLabelText(/^Web address/));
    await user.type(screen.getByLabelText(/^Web address/), 'sunrise-care');
    await screen.findByText('Available');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await user.type(await screen.findByLabelText(/^Mobile number/), '98765');
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    expect(screen.getByText('Enter a 10-digit mobile number.')).toBeVisible();
    await user.type(screen.getByLabelText(/^Mobile number/), '43210');
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    expect(await screen.findByText(/sent a 6-digit code to \*{6}3210/)).toBeVisible();
    await user.click(screen.getByRole('textbox', { name: 'Digit 1 of 6' }));
    await user.keyboard('111111');
    expect(await screen.findByText(/The code is not correct/)).toBeVisible();
    await user.click(screen.getByRole('textbox', { name: 'Digit 1 of 6' }));
    await user.keyboard('123456');

    await user.type(await screen.findByLabelText(/^Your full name/), 'Dr. Meera Iyer');
    await user.type(screen.getByLabelText(/^Work e-mail/), 'meera@sunrise.in');
    await user.click(screen.getByRole('button', { name: 'Create account and start trial' }));
    expect(screen.getByText('Accept the terms to continue.')).toBeVisible();
    await user.click(screen.getByLabelText(/I accept the Terms/));
    await user.click(screen.getByRole('button', { name: 'Create account and start trial' }));
    expect(await screen.findByRole('heading', { name: 'Your trial is ready' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Set my password' })).toHaveAttribute(
      'href',
      'http://sunrise-care.localhost:5173/welcome?token=abc',
    );
    expect(signup).toEqual({
      contact: {
        name: 'Dr. Meera Iyer',
        email: 'meera@sunrise.in',
        mobile: '9876543210',
        otpToken: 'otp_abcdefghijklmnop',
      },
      hospital: { name: 'Sunrise Care', city: 'Pune', beds: 0 },
      subdomain: 'sunrise-care',
      plan: 'CLINIC',
      acceptTermsVersion: '2026-10',
    });
  });
});
