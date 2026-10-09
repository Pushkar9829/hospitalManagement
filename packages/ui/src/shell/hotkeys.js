import { createContext, useContext, useEffect, useId, useRef } from 'react';

/** Hotkey registry API (stable), provided by <HotkeysProvider>. */
export const HotkeysContext = createContext(null);

/** The registered shortcuts with descriptions (changes as pages mount). */
export const HotkeysListContext = createContext([]);

/** True when the event comes from a place the user types into. */
export function isTypingTarget(target) {
  if (!target || !(target instanceof Element)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = (target.getAttribute('type') ?? 'text').toLowerCase();
    return !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file'].includes(
      type,
    );
  }
  return false;
}

/**
 * Does a keyboard event match a combination such as `mod+k`, `alt+s`, `?`, `escape`, `f2`?
 * `mod` is Ctrl on Windows/Linux and Cmd on a Mac (either is accepted).
 */
export function matchesCombo(e, combo) {
  const parts = String(combo).toLowerCase().split('+');
  const key = parts.pop();
  const want = {
    mod: parts.includes('mod'),
    ctrl: parts.includes('ctrl'),
    alt: parts.includes('alt'),
    shift: parts.includes('shift'),
  };
  const ctrlish = e.ctrlKey || e.metaKey;
  if (want.mod) {
    if (!ctrlish) return false;
  } else if (want.ctrl) {
    if (!e.ctrlKey) return false;
  } else if (ctrlish) {
    return false;
  }
  if (want.alt !== Boolean(e.altKey)) return false;
  const symbol = key.length === 1 && !/[a-z0-9]/.test(key);
  if (!symbol && want.shift !== Boolean(e.shiftKey)) return false;
  const pressed = String(e.key ?? '').toLowerCase();
  if (key === 'escape' || key === 'esc') return pressed === 'escape';
  if (key === 'enter') return pressed === 'enter';
  if (/^[a-z]$/.test(key)) return pressed === key || e.code === `Key${key.toUpperCase()}`;
  if (/^[0-9]$/.test(key)) return pressed === key || e.code === `Digit${key}`;
  return pressed === key;
}

/**
 * Registers keyboard shortcuts while the component is mounted.
 *
 *   useHotkeys([{ keys: 'f2', handler: openNewPatient, description: 'New patient' }]);
 *
 * Shortcuts do not fire while typing in a field unless `allowInInputs` is set (Ctrl+K and Alt+S
 * are). Bindings with a `description` are listed in the shortcuts dialog (`?`).
 */
export function useHotkeys(bindings, { enabled = true, group = 'page' } = {}) {
  const ctx = useContext(HotkeysContext);
  const id = useId();
  const latest = useRef(bindings);
  useEffect(() => {
    latest.current = bindings;
  });
  const signature = JSON.stringify(
    (bindings ?? []).map((b) => [b.keys, b.description ?? '', Boolean(b.allowInInputs)]),
  );
  useEffect(() => {
    if (!ctx || !enabled) return undefined;
    const entries = JSON.parse(signature).map(([keys, description, allowInInputs], i) => ({
      keys,
      description: description || undefined,
      allowInInputs,
      group,
      handler: (e) => latest.current?.[i]?.handler?.(e),
    }));
    return ctx.register(id, entries);
  }, [ctx, id, enabled, group, signature]);
}

/**
 * Registers the handler for a page action that a global shortcut triggers: `save` (Alt+S) or
 * `close` (Esc when no dialog is open). The most recently mounted handler wins.
 */
export function usePageAction(name, handler, { enabled = true } = {}) {
  const ctx = useContext(HotkeysContext);
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  useEffect(() => {
    if (!ctx || !enabled) return undefined;
    return ctx.registerAction(name, () => latest.current?.());
  }, [ctx, name, enabled]);
}

/** The registered shortcuts, for the shortcuts dialog. */
export function useRegisteredHotkeys() {
  return useContext(HotkeysListContext);
}
