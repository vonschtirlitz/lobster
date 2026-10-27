import type { Company, FormationState } from '../src/model/types';

const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th'];

export function makeCompany(
  platoonMen: number[],
  opts: Partial<Pick<Company, 'officers' | 'ncos' | 'rankAndFile'>> = {},
): Company {
  return {
    id: 'c1',
    name: 'Test Company',
    rankAndFile: opts.rankAndFile ?? platoonMen.reduce((a, b) => a + b, 0),
    platoons: platoonMen.map((men, i) => ({ id: `p${i}`, name: `${ORDINALS[i]} Platoon`, men })),
    officers: opts.officers ?? { captain: false, lieutenant: false, ensign: false },
    ncos: opts.ncos ?? { sergeants: 0, corporals: 0, drummer: false },
    colour: '#aa3333',
  };
}

/** Two 4-file platoons side by side in close order (0.75 interval), facing up the screen. */
export function twoPlatoonLine(): FormationState {
  return {
    blocks: [
      { platoonId: 'p0', anchor: { x: 1.5, y: 0 }, front: Math.PI / 2, files: 4, ranks: 3 },
      { platoonId: 'p1', anchor: { x: -1.5, y: 0 }, front: Math.PI / 2, files: 4, ranks: 3 },
    ],
    menFacing: 'front',
    order: 'close',
    dressBy: 'right',
  };
}
