import type { DrillSystem } from '../drill/types';
import type { Company, Figure, FormationState, Order, Segment } from '../model/types';
import { layout } from '../model/layout';
import { angleDiff, lerp } from '../model/vec';

const progress = (t: number, t0: number, duration: number) =>
  duration <= 0 ? 1 : Math.min(1, Math.max(0, (t - t0) / duration));

/** Every man moves with the formation: figures come from layout(stateAt(u)). */
export function rigidSegment(
  order: Order,
  t0: number,
  duration: number,
  start: FormationState,
  end: FormationState,
  stateAt: (u: number) => FormationState,
  c: Company,
  d: DrillSystem,
): Segment {
  return {
    order,
    t0,
    t1: t0 + duration,
    start,
    end,
    sample: (t) => layout(c, stateAt(progress(t, t0, duration)), d),
    stateAt: (t) => stateAt(progress(t, t0, duration)),
  };
}

export type Turn = 'cw' | 'ccw' | 'short';

function turnBy(from: number, to: number, turn: Turn): number {
  const dd = angleDiff(to, from);
  if (turn === 'cw' && dd > 1e-9) return dd - 2 * Math.PI;
  if (turn === 'ccw' && dd < -1e-9) return dd + 2 * Math.PI;
  return dd;
}

/** Each man walks a straight line from his start slot to his matched end slot. */
export function slotLerpSegment(
  order: Order,
  t0: number,
  duration: number,
  start: FormationState,
  end: FormationState,
  c: Company,
  d: DrillSystem,
  match?: (startFigs: Figure[], endFigs: Figure[]) => Map<string, string>,
  turn: Turn = 'short',
  figs?: { a: Figure[]; b: Figure[] },
): Segment {
  let moves: { f: Figure; to: Figure; dTheta: number }[] | null = null;
  const build = () => {
    const a = figs?.a ?? layout(c, start, d);
    const b = figs?.b ?? layout(c, end, d);
    const bySlot = new Map(b.map((f) => [f.slot, f]));
    const pairs = match ? match(a, b) : null;
    return a.map((f) => {
      const to = bySlot.get(pairs ? pairs.get(f.slot) ?? f.slot : f.slot) ?? f;
      return { f, to, dTheta: turnBy(f.facing, to.facing, turn) };
    });
  };
  return {
    order,
    t0,
    t1: t0 + duration,
    start,
    end,
    sample: (t) => {
      moves ??= build();
      const u = progress(t, t0, duration);
      return moves.map(({ f, to, dTheta }) => ({ ...f, pos: lerp(f.pos, to.pos, u), facing: f.facing + dTheta * u }));
    },
  };
}

export function errorSegment(order: Order, t0: number, start: FormationState, c: Company, d: DrillSystem, error: string): Segment {
  return { order, t0, t1: t0, start, end: start, error, sample: () => layout(c, start, d) };
}
