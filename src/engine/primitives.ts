import type { DrillSystem } from '../drill/types';
import type { Company, Figure, FormationState, MenFacing, Order, OrderSpacing, Segment } from '../model/types';
import { FACING_OFFSET, blockWidth, flankPos, layout } from '../model/layout';
import { describe, resizeAboutDress, rotateState, translateState } from '../model/formation';
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

/** Checks an order's parameters against its command definition and the drill's rules. */
export function validateParams(order: Order, d: DrillSystem): string | null {
  const def = d.commands.find((c) => c.kind === order.kind);
  if (!def) return 'Unknown command';
  for (const pd of def.params) {
    const val = param(order, pd.key, d);
    if (pd.type === 'number') {
      const x = Number(val);
      if (!Number.isFinite(x)) return `${pd.label} must be a number`;
      if (pd.min !== undefined && x < pd.min) return `${pd.label} must be at least ${pd.min}`;
      if (pd.max !== undefined && x > pd.max) return `${pd.label} must be at most ${pd.max}`;
    } else if (pd.choices && !pd.choices.includes(String(val))) {
      return `${pd.label}: "${String(val)}" is not one of ${pd.choices.join(', ')}`;
    }
  }
  if (order.kind === 'spacing' && !d.defaults.allowedOrders.includes(param(order, 'order', d) as OrderSpacing))
    return `Order: ${String(param(order, 'order', d))} is not used by ${d.name}`;
  if (order.kind === 'depth' && !d.defaults.allowedRanks.includes(Number(param(order, 'ranks', d))))
    return `Ranks: ${String(param(order, 'ranks', d))} deep is not used by ${d.name}`;
  return null;
}

const SLOT = /^p(\d+):f(\d+):r(\d+)$/;

/** Pairs men by their sequence within each platoon: file by file from the right, front to rear. */
export function depthMatch(startFigs: Figure[], endFigs: Figure[]): Map<string, string> {
  const ordered = (figs: Figure[]) => {
    const groups = new Map<string, number[][]>();
    for (const f of figs) {
      const m = SLOT.exec(f.slot);
      if (!m) continue;
      const list = groups.get(m[1]) ?? [];
      list.push([Number(m[2]), Number(m[3])]);
      groups.set(m[1], list);
    }
    for (const list of groups.values()) list.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    return groups;
  };
  const a = ordered(startFigs);
  const b = ordered(endFigs);
  const out = new Map<string, string>();
  for (const [pi, list] of a) {
    const target = b.get(pi) ?? [];
    list.forEach(([f, r], i) => {
      if (target[i]) out.set(`p${pi}:f${f}:r${r}`, `p${pi}:f${target[i][0]}:r${target[i][1]}`);
    });
  }
  return out;
}

function reformSegment(
  order: Order,
  t0: number,
  start: FormationState,
  end: FormationState,
  c: Company,
  d: DrillSystem,
  match?: (a: Figure[], b: Figure[]) => Map<string, string>,
): Segment {
  const a = layout(c, start, d);
  const bFigs = layout(c, end, d);
  const b = new Map(bFigs.map((f) => [f.slot, f.pos]));
  const pairs = match ? match(a, bFigs) : null;
  const furthest = Math.max(0, ...a.map((f) => dist(f.pos, b.get(pairs?.get(f.slot) ?? f.slot) ?? f.pos)));
  const duration = Math.max(d.defaults.beatSeconds, furthest / speed(d, 'ordinary'));
  return slotLerpSegment(order, t0, duration, start, end, c, d, pairs ? () => pairs : undefined, 'short', { a, b: bFigs });
}

export function buildSegment(order: Order, t0: number, start: FormationState, c: Company, d: DrillSystem): Segment {
  const p = (k: string) => param(order, k, d);
  const beat = d.defaults.beatSeconds;
  const invalid = validateParams(order, d);
  if (invalid) return errorSegment(order, t0, start, c, d, invalid);

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
    case 'spacing':
    case 'depth': {
      if (start.menFacing !== 'front') return errorSegment(order, t0, start, c, d, 'Front the men before re-forming');
      const end =
        order.kind === 'spacing'
          ? resizeAboutDress(c, start, p('order') as OrderSpacing, null, d)
          : resizeAboutDress(c, start, null, Number(p('ranks')), d);
      return reformSegment(order, t0, start, end, c, d, order.kind === 'depth' ? depthMatch : undefined);
    }
    case 'wait':
      return rigidSegment(order, t0, Number(p('seconds')), start, start, () => start, c, d);
    default:
      return errorSegment(order, t0, start, c, d, 'Unknown command');
  }
}
