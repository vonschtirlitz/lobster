import type { DrillSystem } from '../drill/types';
import type { Company, FormationState } from '../model/types';
import { companyFront, companyRanks, describe, guidePoint } from '../model/formation';
import { angleDiff, dist } from '../model/vec';

export interface GhostComparison {
  distance: number; // paces between guide points
  frontDeg: number;
  mismatches: string[];
  pass: boolean;
}

export function compareToGhost(
  c: Company,
  end: FormationState,
  ghost: FormationState,
  d: DrillSystem,
  tol: { paces: number; degrees: number },
): GhostComparison {
  const distance = dist(guidePoint(c, end, d), guidePoint(c, ghost, d));
  const frontDeg = Math.abs((angleDiff(companyFront(end), companyFront(ghost)) * 180) / Math.PI);
  const files = (s: FormationState) => s.blocks.reduce((n, b) => n + b.files, 0);
  const checks: [string, unknown, unknown][] = [
    ['shape', describe(end, d), describe(ghost, d)],
    [d.terms.files ?? 'files', files(end), files(ghost)],
    [d.terms.ranks ?? 'ranks', companyRanks(end), companyRanks(ghost)],
    ['order', end.order, ghost.order],
    ['dress', end.dressBy, ghost.dressBy],
    ['facing', end.menFacing, ghost.menFacing],
  ];
  const mismatches = checks.filter(([, a, b]) => a !== b).map(([k, a, b]) => `${k}: ${a} ≠ ${b}`);
  const pass = distance <= tol.paces && frontDeg <= tol.degrees && mismatches.length === 0;
  return { distance, frontDeg, mismatches, pass };
}
