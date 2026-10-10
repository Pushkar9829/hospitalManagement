import {
  Building2,
  ChevronDown,
  Keyboard,
  KeyRound,
  Languages,
  LogOut,
  Menu as MenuIcon,
  Palette,
  Search,
  UserRound,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn.js';
import { initials } from '../lib/format.js';
import { IconButton } from '../primitives/IconButton.jsx';
import { Kbd } from '../primitives/Kbd.jsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../primitives/Menu.jsx';
import { THEMES } from './themes.js';

const themeKey = {
  light: 'topbar.themeLight',
  dark: 'topbar.themeDark',
  contrast: 'topbar.themeContrast',
};

/**
 * Top bar: menu button (tablet), breadcrumb and title, the palette search button, a branch
 * switcher when the user has more than one branch, and the account menu (My Space, change
 * password, theme, language, shortcuts, sign out).
 */
export function TopBar({
  title,
  breadcrumb,
  onMenuClick,
  onOpenPalette,
  branches = [],
  branchId,
  onBranchChange,
  user,
  theme = 'light',
  onThemeChange,
  language = 'en',
  languages = [],
  onLanguageChange,
  onMySpace,
  onChangePassword,
  onShortcuts,
  onSignOut,
  className,
}) {
  const { t } = useTranslation();
  const branch = branches.find((b) => b.id === branchId);
  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex min-h-topbar items-center gap-3 border-b border-line bg-surface px-4 md:px-6',
        className,
      )}
    >
      {onMenuClick && (
        <IconButton
          label={t('common.openMenu')}
          icon={<MenuIcon size={20} aria-hidden="true" />}
          onClick={onMenuClick}
          className="-ml-2 lg:hidden"
        />
      )}
      <div className="min-w-0 flex-1 py-2">
        {breadcrumb && <p className="truncate text-sm text-muted">{breadcrumb}</p>}
        {title && <p className="truncate text-lg font-semibold text-ink">{title}</p>}
      </div>

      {onOpenPalette && (
        <button
          type="button"
          onClick={onOpenPalette}
          aria-keyshortcuts="Control+K Meta+K"
          className="inline-flex min-h-tap cursor-pointer items-center gap-2 rounded-control border border-line-strong bg-surface px-3 text-base text-muted transition-colors hover:border-muted hover:text-ink md:w-64 xl:w-80"
        >
          <Search size={16} aria-hidden="true" />
          <span className="sr-only md:not-sr-only md:flex-1 md:text-left">
            {t('topbar.search')}
          </span>
          <Kbd keys="mod+k" className="hidden md:inline-flex" />
        </button>
      )}

      {branches.length > 1 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`${t('topbar.switchBranch')}: ${branch?.name ?? ''}`}
              className="inline-flex min-h-tap cursor-pointer items-center gap-2 rounded-control border border-line-strong bg-surface px-3 text-base font-medium text-ink hover:bg-surface-2"
            >
              <Building2 size={16} aria-hidden="true" className="text-muted" />
              <span className="hidden max-w-40 truncate xl:inline">{branch?.name}</span>
              <ChevronDown size={14} aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>{t('topbar.branch')}</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={branchId} onValueChange={(id) => onBranchChange?.(id)}>
              {branches.map((b) => (
                <DropdownMenuRadioItem key={b.id} value={b.id}>
                  {b.name}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {user && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={t('topbar.userMenu', { name: user.name })}
              className="inline-flex min-h-tap cursor-pointer items-center gap-2.5 rounded-control px-1.5 text-left hover:bg-surface-2"
            >
              <span
                aria-hidden="true"
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-info-bg text-sm font-semibold text-info"
              >
                {initials(user.name)}
              </span>
              <span className="hidden min-w-0 xl:block">
                <span className="block max-w-48 truncate text-base font-semibold text-ink">
                  {user.name}
                </span>
                {user.subtitle && (
                  <span className="block max-w-48 truncate text-sm text-muted">
                    {user.subtitle}
                  </span>
                )}
              </span>
              <ChevronDown size={14} aria-hidden="true" className="text-muted" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64">
            <div className="px-2.5 py-2 xl:hidden">
              <p className="truncate font-semibold">{user.name}</p>
              {user.subtitle && <p className="truncate text-sm text-muted">{user.subtitle}</p>}
            </div>
            <DropdownMenuSeparator className="xl:hidden" />
            {onMySpace && (
              <DropdownMenuItem icon={<UserRound size={16} />} onSelect={onMySpace}>
                {t('topbar.mySpace')}
              </DropdownMenuItem>
            )}
            {onChangePassword && (
              <DropdownMenuItem icon={<KeyRound size={16} />} onSelect={onChangePassword}>
                {t('topbar.changePassword')}
              </DropdownMenuItem>
            )}
            {onShortcuts && (
              <DropdownMenuItem icon={<Keyboard size={16} />} shortcut="?" onSelect={onShortcuts}>
                {t('topbar.shortcuts')}
              </DropdownMenuItem>
            )}
            {onThemeChange && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="flex items-center gap-2">
                  <Palette size={12} aria-hidden="true" />
                  {t('topbar.theme')}
                </DropdownMenuLabel>
                <DropdownMenuRadioGroup value={theme} onValueChange={onThemeChange}>
                  {THEMES.map((th) => (
                    <DropdownMenuRadioItem key={th} value={th}>
                      {t(themeKey[th])}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </>
            )}
            {onLanguageChange && languages.length > 1 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="flex items-center gap-2">
                  <Languages size={12} aria-hidden="true" />
                  {t('topbar.language')}
                </DropdownMenuLabel>
                <DropdownMenuRadioGroup value={language} onValueChange={onLanguageChange}>
                  {languages.map((l) => (
                    <DropdownMenuRadioItem key={l.code} value={l.code} lang={l.code}>
                      {l.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </>
            )}
            {onSignOut && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem icon={<LogOut size={16} />} onSelect={onSignOut}>
                  {t('topbar.signOut')}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </header>
  );
}
