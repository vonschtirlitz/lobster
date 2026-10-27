import type { Company, DressPoint } from './types';

export function filesFor(men: number, ranks: number): number {
  if (men <= 0) return 0;
  return Math.max(1, Math.ceil(men / Math.max(1, ranks)));
}

export const shortSide = (dress: DressPoint): 'left' | 'right' => (dress === 'left' ? 'right' : 'left');

/** Even split; the remainder goes to the right-hand platoons first. */
export function splitMen(total: number, platoons: number): number[] {
  if (platoons <= 0) return [];
  const base = Math.floor(total / platoons);
  const extra = total - base * platoons;
  return Array.from({ length: platoons }, (_, i) => base + (i < extra ? 1 : 0));
}

export function platoonWarnings(c: Company, ranks: number): string[] {
  return c.platoons
    .filter((p) => p.men > 0 && p.men % ranks !== 0)
    .map((p) => `${p.name}: ${p.men} men do not divide into ${ranks} ranks`);
}

export function platoonTotal(c: Company): number {
  return c.platoons.reduce((a, p) => a + p.men, 0);
}
