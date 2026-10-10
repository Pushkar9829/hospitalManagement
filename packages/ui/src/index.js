// @hms/ui: design tokens (import '@hms/ui/tokens.css') and the component kit every module uses.

// helpers
export { cn } from './lib/cn.js';
export { safeStorage } from './lib/storage.js';
export {
  formatTime,
  formatLongDate,
  formatDateTime,
  istHour,
  initials,
  IST,
} from './lib/format.js';
export { useOnlineStatus } from './lib/useOnlineStatus.js';

// primitives
export { Button } from './primitives/Button.jsx';
export { buttonVariants, buttonSizes } from './primitives/button-styles.js';
export { IconButton } from './primitives/IconButton.jsx';
export { Spinner } from './primitives/Spinner.jsx';
export { Input, controlClass } from './primitives/Input.jsx';
export { Textarea } from './primitives/Textarea.jsx';
export { Select } from './primitives/Select.jsx';
export { Checkbox } from './primitives/Checkbox.jsx';
export { CodeInput } from './primitives/CodeInput.jsx';
export { FormField } from './primitives/FormField.jsx';
export { FieldContext, useFieldProps } from './primitives/field-context.js';
export { Dialog, DialogClose } from './primitives/Dialog.jsx';
export { Drawer } from './primitives/Drawer.jsx';
export { Sheet } from './primitives/Sheet.jsx';
export { Tabs, TabsList, TabsTrigger, TabsContent } from './primitives/Tabs.jsx';
export { Tooltip, TooltipProvider } from './primitives/Tooltip.jsx';
export { ToastProvider } from './primitives/Toast.jsx';
export { useToast } from './primitives/toast-context.js';
export { Kbd } from './primitives/Kbd.jsx';
export { keyLabel, isMac } from './primitives/keys.js';
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from './primitives/Menu.jsx';

// data
export { DataTable } from './data/DataTable.jsx';
export { parseSort, nextSort } from './data/sort.js';
export { Pagination } from './data/Pagination.jsx';
export { EmptyState } from './data/EmptyState.jsx';
export { Skeleton } from './data/Skeleton.jsx';
export { StatTile } from './data/StatTile.jsx';
export { QrCode } from './data/QrCode.jsx';
export { DiffTable } from './data/DiffTable.jsx';
export { diffRows, flatten } from './data/diff.js';

// clinical
export { PatientBanner } from './clinical/PatientBanner.jsx';
export { PatientCell } from './clinical/PatientCell.jsx';
export { AllergyChip } from './clinical/AllergyChip.jsx';
export { CriticalAlert } from './clinical/CriticalAlert.jsx';

// feedback
export { StatusBadge } from './feedback/StatusBadge.jsx';
export { Banner } from './feedback/Banner.jsx';
export { ApprovalBanner } from './feedback/ApprovalBanner.jsx';
export { ConfirmDialog } from './feedback/ConfirmDialog.jsx';
export { toneClasses, toneClass } from './feedback/tones.js';
export {
  Empty,
  Loading,
  ErrorState,
  Forbidden403,
  NotSubscribed402,
  SubscriptionBanner,
  PendingApproval202,
  SessionExpired,
  Offline,
  Conflict409,
  DeviceNotConnected,
  NotFound404,
} from './feedback/StateViews.jsx';

// layout
export { Page } from './layout/Page.jsx';
export { PageHeader } from './layout/PageHeader.jsx';
export { Card } from './layout/Card.jsx';
export { SplitView } from './layout/SplitView.jsx';
export { Stepper } from './layout/Stepper.jsx';

// shell
export { AppShell } from './shell/AppShell.jsx';
export { Sidebar } from './shell/Sidebar.jsx';
export { routeMatches, findActiveItem } from './shell/routes.js';
export { TopBar } from './shell/TopBar.jsx';
export { THEMES } from './shell/themes.js';
export { CommandPalette } from './shell/CommandPalette.jsx';
export { paletteFilter } from './shell/palette-filter.js';
export { ShortcutsDialog } from './shell/ShortcutsDialog.jsx';
export { HotkeysProvider } from './shell/HotkeysProvider.jsx';
export {
  useHotkeys,
  usePageAction,
  useRegisteredHotkeys,
  matchesCombo,
  isTypingTarget,
  HotkeysContext,
} from './shell/hotkeys.js';
