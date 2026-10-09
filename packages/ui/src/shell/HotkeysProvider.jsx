import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HotkeysContext, HotkeysListContext, isTypingTarget, matchesCombo } from './hotkeys.js';

function dialogOpen() {
  return Boolean(document.querySelector('[role="dialog"],[role="alertdialog"]'));
}

/**
 * Global keyboard handling. Built in: Alt+S runs the page's `save` action, Esc runs its `close`
 * action when no dialog is open. Everything else is registered with `useHotkeys`.
 */
export function HotkeysProvider({ children }) {
  const registry = useRef(new Map());
  const actions = useRef(new Map());
  const [list, setList] = useState([]);

  const refreshList = useCallback(() => {
    const seen = new Set();
    const out = [];
    for (const entries of [...registry.current.values()].reverse()) {
      for (const b of entries) {
        if (!b.description || seen.has(b.keys)) continue;
        seen.add(b.keys);
        out.push({ keys: b.keys, description: b.description, group: b.group });
      }
    }
    setList(out.reverse());
  }, []);

  const register = useCallback(
    (id, entries) => {
      registry.current.set(id, entries);
      refreshList();
      return () => {
        registry.current.delete(id);
        refreshList();
      };
    },
    [refreshList],
  );

  const registerAction = useCallback((name, fn) => {
    const stack = actions.current.get(name) ?? [];
    stack.push(fn);
    actions.current.set(name, stack);
    return () => {
      const s = actions.current.get(name) ?? [];
      const i = s.lastIndexOf(fn);
      if (i >= 0) s.splice(i, 1);
    };
  }, []);

  const runAction = useCallback((name) => {
    const stack = actions.current.get(name);
    const fn = stack?.[stack.length - 1];
    if (!fn) return false;
    fn();
    return true;
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.defaultPrevented || e.isComposing) return;
      const typing = isTypingTarget(e.target);
      if (matchesCombo(e, 'alt+s')) {
        if (runAction('save')) e.preventDefault();
        return;
      }
      if (matchesCombo(e, 'escape') && !dialogOpen()) {
        if (runAction('close')) e.preventDefault();
        return;
      }
      // Latest registration wins, so a page can override a global shortcut.
      const all = [...registry.current.values()].reverse().flat();
      for (const b of all) {
        if (!matchesCombo(e, b.keys)) continue;
        if (typing && !b.allowInInputs) return;
        e.preventDefault();
        b.handler(e);
        return;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [runAction]);

  const api = useMemo(
    () => ({ register, registerAction, runAction }),
    [register, registerAction, runAction],
  );
  return (
    <HotkeysContext.Provider value={api}>
      <HotkeysListContext.Provider value={list}>{children}</HotkeysListContext.Provider>
    </HotkeysContext.Provider>
  );
}
