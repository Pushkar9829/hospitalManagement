import { useTranslation } from 'react-i18next';
import { Drawer } from '../primitives/Drawer.jsx';

/**
 * Page frame: 232 px menu on the left from 1024 px up; below that the menu is a drawer opened
 * from the top bar's menu button. A skip link jumps to the main content.
 */
export function AppShell({
  sidebar,
  drawerSidebar,
  topbar,
  banner,
  drawerOpen,
  onDrawerOpenChange,
  children,
}) {
  const { t } = useTranslation();
  return (
    <div className="min-h-dvh bg-ground">
      <a
        href="#main"
        className="sr-only z-[70] rounded-control bg-primary px-4 py-2 text-on-primary focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {t('app.skipToContent')}
      </a>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-menu lg:block">{sidebar}</aside>
      <Drawer
        open={drawerOpen}
        onOpenChange={onDrawerOpenChange}
        title={t('menu.navigation')}
        closeLabel={t('common.closeMenu')}
      >
        {drawerSidebar ?? sidebar}
      </Drawer>
      <div className="flex min-h-dvh min-w-0 flex-col lg:pl-menu">
        {topbar}
        {banner && <div className="flex flex-col gap-2 px-4 pt-4 md:px-6">{banner}</div>}
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}
