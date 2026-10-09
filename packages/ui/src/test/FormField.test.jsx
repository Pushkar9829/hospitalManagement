import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FormField, Input, Select, Textarea, CodeInput } from '../index.js';

describe('FormField', () => {
  it('labels the control and links the hint', () => {
    render(
      <FormField label="Mobile" hint="10 digits">
        <Input />
      </FormField>,
    );
    const input = screen.getByLabelText('Mobile');
    expect(input.tagName).toBe('INPUT');
    expect(input).toHaveAccessibleDescription('10 digits');
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('marks the control invalid and describes it with the error first', () => {
    render(
      <FormField label="Mobile" hint="10 digits" error="Enter a 10-digit mobile number" required>
        <Input />
      </FormField>,
    );
    const input = screen.getByRole('textbox', { name: /Mobile/ });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toBeRequired();
    expect(input).toHaveAccessibleDescription('Enter a 10-digit mobile number 10 digits');
    const errorId = input.getAttribute('aria-describedby').split(' ')[0];
    expect(document.getElementById(errorId)).toHaveTextContent('Enter a 10-digit mobile number');
  });

  it('wires Select and Textarea the same way', () => {
    render(
      <>
        <FormField label="Category" error="Pick one">
          <Select options={[{ value: 'g', label: 'General' }]} placeholder="Choose" />
        </FormField>
        <FormField label="Notes" hint="Shown on the slip">
          <Textarea />
        </FormField>
      </>,
    );
    expect(screen.getByLabelText('Category')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Category')).toHaveAccessibleDescription('Pick one');
    expect(screen.getByLabelText('Notes')).toHaveAccessibleDescription('Shown on the slip');
  });

  it('keeps an explicit id and extra aria-describedby', () => {
    render(
      <>
        <p id="extra">Extra help</p>
        <FormField label="Name" id="patient-name" hint="As on ID">
          <Input aria-describedby="extra" />
        </FormField>
      </>,
    );
    const input = screen.getByLabelText('Name');
    expect(input).toHaveAttribute('id', 'patient-name');
    expect(input).toHaveAccessibleDescription('As on ID Extra help');
  });

  it('labels the first box of a CodeInput and invalidates every box', () => {
    render(
      <FormField label="Code" error="Enter the 6-digit code">
        <CodeInput value="" onChange={() => {}} label="Code" />
      </FormField>,
    );
    const boxes = screen.getAllByRole('textbox');
    expect(boxes).toHaveLength(6);
    for (const b of boxes) expect(b).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('group', { name: 'Code' })).toBeInTheDocument();
  });
});
