import type { DrillSystem } from '../drill/types';
import type { Company, FormationState, MenFacing, Order, Segment } from '../model/types';
import { FACING_OFFSET, blockWidth, flankPos } from '../model/layout';
import { describe, rotateState, translateState } from '../model/formation';
import { angleDiff, dist, fwd, scale } from '../model/vec';
import { errorSegment, rigidSegment, slotLerpSegment } from './segment';

/** Paces per second for a named step. */
export const speed = (d: DrillSystem, step: string) =>
  (d.defaults.steps[step] ?? d.defaults.steps.ordinary ?? { pacesPerMinute: 60 }).pacesPerMinute / 60;

/** A parameter's value, falling back to the command's default. */
export function param(order: Order, key: string, d: DrillSystem): unknown {
  if (order.params[key] !== undefined) return order.params[key];
  return d.commands.find((c) => c.kind === order.kind)?.params.find((p) => p.key === key)?.default;
}

function facingAfter(current: MenFacing, direction: string): MenFacing {
  if (direction === 'front') return 'front';
  const turn = direction === 'right' ? -Math.PI / 2 : direction === 'left' ? Math.PI / 2 : Math.PI;
  const target = FACING_OFFSET[current] + turn;
  const names = Object.keys(FACING_OFFSET) as MenFacing[];
  return names.find((n) => Math.abs(angleDiff(FACING_OFFSET[n], target)) < 1e-6)!;
}

export function buildSegment(order: Order, t0: number, start: FormationState, c: Company, d: DrillSystem): Segment {
  const p = (k: string) => param(order, k, d);
  const beat = d.defaults.beatSeconds;

  switch (order.kind) {
    case 'face': {
      const direction = String(p('direction'));
      const end = { ...start, menFacing: facingAfter(start.menFacing, direction) };
      const turn = direction === 'left' ? 'ccw' : direction === 'front' ? 'short' : 'cw';
      return slotLerpSegment(order, t0, beat, start, end, c, d, undefined, turn);
    }
    case 'march': {
      const paces = Number(p('paces'));
      const stateAt = (u: number): FormationState => ({
        ...start,
        blocks: start.blocks.map(
          (b) => translateState({ ...start, blocks: [b] }, scale(fwd(b.front + FACING_OFFSET[start.menFacing]), paces * u)).blocks[0],
        ),
      });
      return rigidSegment(order, t0, paces / speed(d, String(p('step'))), start, stateAt(1), stateAt, c, d);
    }
    case 'dress': {
      const end = { ...start, dressBy: p('point') as FormationState['dressBy'] };
      return rigidSegment(order, t0, beat, start, end, (u) => (u >= 1 ? end : start), c, d);
    }
    case 'wheel': {
      if (start.menFacing !== 'front') return errorSegment(order, t0, start, c, d, 'Cannot wheel while faced to a flank');
      const byCompany = p('by') !== 'platoons';
      if (byCompany && describe(start, d) !== 'line')
        return errorSegment(order, t0, start, c, d, 'Company must be in line to wheel as one');
      const side = p('direction') === 'left' ? 'left' : 'right';
      const angle = ((side === 'right' ? -1 : 1) * Number(p('degrees')) * Math.PI) / 180;
      const fi = d.defaults.fileInterval[start.order];
      const occupied = start.blocks.filter((b) => b.files > 0);
      let stateAt: (u: number) => FormationState;
      let width: number;
      if (byCompany) {
        const unit = side === 'right' ? occupied[0] : occupied[occupied.length - 1];
        const pivot = flankPos(unit, side, fi);
        width = dist(flankPos(occupied[0], 'right', fi), flankPos(occupied[occupied.length - 1], 'left', fi));
        stateAt = (u) => rotateState(start, pivot, angle * u);
      } else {
        const pivots = start.blocks.map((b) => flankPos(b, side, fi));
        width = Math.max(0, ...start.blocks.map((b) => blockWidth(b, fi)));
        stateAt = (u) => ({
          ...start,
          blocks: start.blocks.map((b, i) => rotateState({ ...start, blocks: [b] }, pivots[i], angle * u).blocks[0]),
        });
      }
      const duration = (width * Math.abs(angle)) / speed(d, 'ordinary');
      return rigidSegment(order, t0, duration, start, stateAt(1), stateAt, c, d);
    }
    case 'wait':
      return rigidSegment(order, t0, Number(p('seconds')), start, start, () => start, c, d);
    default:
      return errorSegment(order, t0, start, c, d, 'Unknown command');
  }
}
