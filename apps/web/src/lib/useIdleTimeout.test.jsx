import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, renderHook } from '@testing-library/react';
import { useIdleTimeout } from './useIdleTimeout.js';

describe('useIdleTimeout', () => {
  afterEach(() => vi.useRealTimers());

  it('fires once after the idle period and not while the user is active', () => {
    vi.useFakeTimers();
    const onIdle = vi.fn();
    renderHook(() => useIdleTimeout({ minutes: 1, onIdle, checkEveryMs: 1000 }));
    vi.advanceTimersByTime(40_000);
    fireEvent.keyDown(window, { key: 'a' });
    vi.advanceTimersByTime(40_000);
    expect(onIdle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(25_000);
    expect(onIdle).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(120_000);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });
});
