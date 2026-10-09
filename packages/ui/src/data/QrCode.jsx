import { useMemo } from 'react';
import { encode } from 'uqr';
import { cn } from '../lib/cn.js';

/**
 * QR code as inline SVG (2FA set-up, wristbands, token slips). Always dark on light, in every
 * theme, so phone cameras can read it. `label` is the accessible name.
 */
export function QrCode({ value, label, size = 192, className }) {
  const { path, count } = useMemo(() => {
    const qr = encode(value ?? '', { ecc: 'M', border: 4 });
    const parts = [];
    qr.data.forEach((row, y) =>
      row.forEach((dark, x) => {
        if (dark) parts.push(`M${x} ${y}h1v1h-1z`);
      }),
    );
    return { path: parts.join(''), count: qr.data.length };
  }, [value]);
  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox={`0 0 ${count} ${count}`}
      shapeRendering="crispEdges"
      className={cn('rounded-control', className)}
    >
      <rect width={count} height={count} className="fill-qr-light" />
      <path d={path} className="fill-qr-dark" />
    </svg>
  );
}
