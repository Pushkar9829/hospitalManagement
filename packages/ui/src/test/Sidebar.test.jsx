import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Sidebar, findActiveItem, routeMatches } from '../index.js';

const menu = [
  {
    group: 'My ward',
    items: [
      { label: 'Home', screen: 'Home', route: '/home' },
      { label: 'Bed Board', screen: 'Beds', route: '/ipd/beds' },
      { label: 'Patient Profile', screen: 'PatientProfile', route: '/patients/:id' },
    ],
  },
  {
    group: 'Results',
    items: [{ label: 'Sample Collection', screen: 'LabSample', route: '/lab/samples' }],
  },
];

function renderSidebar(props = {}) {
  const onNavigate = vi.fn();
  const utils = render(
    <Sidebar
      menu={menu}
      activePath="/ipd/beds"
      onNavigate={onNavigate}
      tenantName="Demo Hospital"
      branchName="Main Branch"
      panelName="Staff Nurse"
      storageKey="test:menu"
      {...props}
    />,
  );
  return { ...utils, onNavigate, user: userEvent.setup() };
}

describe('Sidebar', () => {
  it('matches routes with parameters and prefers exact routes', () => {
    expect(routeMatches('/patients/:id', '/patients/42')).toBe(true);
    expect(routeMatches('/', '/home')).toBe(false);
    expect(findActiveItem(menu, '/patients/42').screen).toBe('PatientProfile');
  });

  it('shows the tenant and marks the active item', () => {
    renderSidebar();
    expect(screen.getByText('Demo Hospital')).toBeInTheDocument();
    expect(screen.getByText('Main Branch · Staff Nurse')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Bed Board' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
    expect(screen.queryByText(/All role panels/)).toBeNull();
  });

  it('navigates on a plain click', async () => {
    const { user, onNavigate } = renderSidebar();
    await user.click(screen.getByRole('link', { name: 'Sample Collection' }));
    expect(onNavigate).toHaveBeenCalledWith(
      '/lab/samples',
      expect.objectContaining({ screen: 'LabSample' }),
    );
  });

  it('filters items with the search box and opens the first match with Enter', async () => {
    const { user, onNavigate } = renderSidebar();
    const search = screen.getByRole('searchbox', { name: 'Search menu' });
    await user.type(search, 'sample');
    const nav = screen.getByRole('navigation', { name: 'Main menu' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual(['Sample Collection']);
    await user.keyboard('{Enter}');
    expect(onNavigate).toHaveBeenCalledWith('/lab/samples', expect.anything());

    await user.type(search, 'zzz');
    expect(screen.getByText('No menu item matches “zzz”.')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(search).toHaveValue('');
  });

  it('adds favourites to a pinned group and remembers them', async () => {
    const { user, unmount } = renderSidebar();
    await user.click(screen.getByRole('button', { name: 'Add Sample Collection to favourites' }));
    const fav = screen.getByRole('button', { name: /Favourites/ });
    expect(fav).toHaveAttribute('aria-expanded', 'true');
    const favList = document.getElementById(fav.getAttribute('aria-controls'));
    expect(within(favList).getByRole('link', { name: 'Sample Collection' })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('test:menu:favourites'))).toEqual(['LabSample']);
    expect(
      within(favList).getByRole('button', { name: 'Remove Sample Collection from favourites' }),
    ).toHaveAttribute('aria-pressed', 'true');

    unmount();
    renderSidebar();
    // Favourites group renders first, before "My ward".
    const headings = screen.getAllByRole('button', { expanded: true }).map((b) => b.textContent);
    expect(headings[0]).toBe('Favourites');
  });

  it('collapses groups and remembers it', async () => {
    const { user, unmount } = renderSidebar();
    const group = screen.getByRole('button', { name: 'My ward' });
    await user.click(group);
    expect(group).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: 'Home' })).toBeNull();
    expect(JSON.parse(localStorage.getItem('test:menu:collapsed'))).toEqual(['My ward']);

    unmount();
    renderSidebar();
    expect(screen.getByRole('button', { name: 'My ward' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    // Searching still finds items inside a collapsed group.
    const user2 = userEvent.setup();
    await user2.type(screen.getByRole('searchbox'), 'home');
    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
  });

  it('works when localStorage throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    renderSidebar();
    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
    spy.mockRestore();
  });
});
