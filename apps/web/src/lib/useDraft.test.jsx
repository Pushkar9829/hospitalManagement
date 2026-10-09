import { describe, expect, it, vi } from 'vitest';
import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { clearAllDrafts, useDraft, useFormDraft } from './useDraft.js';

describe('useDraft', () => {
  it('saves after a pause and restores on the next mount', () => {
    vi.useFakeTimers();
    const first = renderHook(() => useDraft('note'));
    act(() => first.result.current.save({ text: 'BP 130/80' }));
    expect(localStorage.getItem('hms:draft:note')).toBeNull();
    act(() => vi.advanceTimersByTime(700));
    first.unmount();
    vi.useRealTimers();
    const second = renderHook(() => useDraft('note'));
    expect(second.result.current.draft).toEqual({ text: 'BP 130/80' });
    act(() => second.result.current.clear());
    expect(localStorage.getItem('hms:draft:note')).toBeNull();
  });

  it('flushes a pending save when the form unmounts', () => {
    const { result, unmount } = renderHook(() => useDraft('pending'));
    act(() => result.current.save({ a: 1 }));
    unmount();
    expect(JSON.parse(localStorage.getItem('hms:draft:pending')).values).toEqual({ a: 1 });
  });

  it('survives a storage that throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded');
    });
    const { result, unmount } = renderHook(() => useDraft('x'));
    expect(() => act(() => result.current.saveNow())).not.toThrow();
    act(() => result.current.save({ a: 1 }));
    expect(() => unmount()).not.toThrow();
  });

  it('restores a react-hook-form form and clears all drafts on sign-out', async () => {
    localStorage.setItem('hms:draft:form', JSON.stringify({ values: { note: 'kept' } }));
    function Form() {
      const form = useForm({ defaultValues: { note: '' } });
      useFormDraft('form', form);
      return <input aria-label="Note" {...form.register('note')} />;
    }
    render(<Form />);
    expect(await screen.findByDisplayValue('kept')).toBeInTheDocument();
    await userEvent.setup().type(screen.getByLabelText('Note'), '!');
    clearAllDrafts();
    expect(localStorage.getItem('hms:draft:form')).toBeNull();
  });
});
