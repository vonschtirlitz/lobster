import type { DrillSystem } from '../drill/types';
import type { Block, Company, Figure, FormationState, MenFacing, Vec2 } from './types';
import { shortSide } from './telloff';
import { add, angleDiff, fwd, right, scale, sub } from './vec';

export const FACING_OFFSET: Record<MenFacing, number> = {
  front: 0,
  right: -Math.PI / 2,
  left: Math.PI / 2,
  about: Math.PI,
};

export const menFacingAngle = (front: number, m: MenFacing) => front + FACING_OFFSET[m];

/** File f counts from the right (0 = right flank); rank r from the front (0 = front rank). */
export function slotPos(b: Block, f: number, r: number, fileInterval: number, rankDistance: number): Vec2 {
  const across = ((b.files - 1) / 2 - f) * fileInterval;
  return add(add(b.anchor, scale(right(b.front), across)), scale(fwd(b.front), -r * rankDistance));
}

/** Front-rank position of a block's flank file. */
export const flankPos = (b: Block, side: 'right' | 'left', fileInterval: number): Vec2 =>
  slotPos(b, side === 'right' ? 0 : Math.max(0, b.files - 1), 0, fileInterval, 0);

export const blockWidth = (b: Block, fileInterval: number) => Math.max(0, b.files - 1) * fileInterval;

/** True when every block shares one front and stands on one front line. */
export function blocksInLine(s: FormationState, tol = 0.05): boolean {
  const b0 = s.blocks[0];
  if (!b0) return false;
  const f = fwd(b0.front);
  return s.blocks.every((b) => {
    if (Math.abs(angleDiff(b.front, b0.front)) > (0.5 * Math.PI) / 180) return false;
    const d = sub(b.anchor, b0.anchor);
    return Math.abs(d.x * f.x + d.y * f.y) <= tol;
  });
}

export function layout(c: Company, s: FormationState, d: DrillSystem): Figure[] {
  const fi = d.defaults.fileInterval[s.order];
  const rd = d.defaults.rankDistance[s.order];
  const fillFromRight = shortSide(s.dressBy) === 'left';
  const figs: Figure[] = [];

  s.blocks.forEach((b) => {
    const pi = c.platoons.findIndex((p) => p.id === b.platoonId);
    const men = pi >= 0 ? c.platoons[pi].men : 0;
    if (men <= 0 || b.files <= 0 || b.ranks <= 0) return;
    const facing = menFacingAngle(b.front, s.menFacing);
    let placed = 0;
    for (let k = 0; k < b.files && placed < men; k++) {
      const f = fillFromRight ? k : b.files - 1 - k;
      for (let r = 0; r < b.ranks && placed < men; r++, placed++) {
        figs.push({
          role: 'private',
          platoonId: b.platoonId,
          slot: `p${pi}:f${f}:r${r}`,
          pos: slotPos(b, f, r, fi, rd),
          facing,
        });
      }
    }
  });

  return figs.concat(d.postOfficersAndNcos(c, s));
}
