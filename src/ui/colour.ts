const rgb = (hex: string): number[] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const hex = (c: number[]) => `#${c.map((x) => Math.round(x).toString(16).padStart(2, '0')).join('')}`;

export function mix(from: string, toward: string, k: number): string {
  const a = rgb(from);
  const b = rgb(toward);
  if ([...a, ...b].some(Number.isNaN)) return from;
  return hex(a.map((x, i) => x + (b[i] - x) * k));
}

function luminance(colour: string): number {
  const [r, g, b] = rgb(colour).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio between two hex colours. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const MIN_CONTRAST = 3.2; // WCAG non-text minimum is 3:1; the margin absorbs antialiasing
const PLATOON_STEPS = [0, 0.3, 0.15, 0.45];

/**
 * A platoon's fill: the company colour pushed toward the ink colour until it
 * clears 3:1 on the field, then stepped further per platoon so neighbours differ.
 */
export function platoonColour(base: string, platoonIndex: number, field: string, ink: string): string {
  let k = 0;
  while (k < 0.5 && contrastRatio(mix(base, ink, k), field) < MIN_CONTRAST) k += 0.05;
  return mix(base, ink, Math.min(0.95, k + PLATOON_STEPS[platoonIndex % PLATOON_STEPS.length]));
}
