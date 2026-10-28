import { execute, endState } from '../../src/engine/execute';
import { compareToGhost } from '../../src/engine/compare';
import { asLine, lineAnchor, translateState } from '../../src/model/formation';
import { layout } from '../../src/model/layout';
import { gb1764 as d } from '../../src/drill/gb1764';
import { makeCompany } from '../helpers';
import { dist } from '../../src/model/vec';
import type { Company, Order } from '../../src/model/types';
import type { CommandKind } from '../../src/drill/types';

const up = Math.PI / 2;
let n = 0;
const o = (kind: CommandKind, params: Record<string, unknown>): Order => ({ id: `o${n++}`, kind, params });
const company = (id: string, men = [12, 12]): Company => ({ ...makeCompany(men), id });
const line = (c: Company, x = 0) => asLine(c, { x, y: 0 }, up, 3, 'close', 'right', d);

describe('execute', () => {
  it('runs companies in parallel and holds the shorter one at its end', () => {
    const a = company('a');
    const b = company('b');
    const tl = execute(
      [
        { company: a, start: line(a), orders: [o('march', { paces: 10, step: 'ordinary' })] },
        { company: b, start: line(b, 20), orders: [o('march', { paces: 30, step: 'ordinary' })] },
      ],
      d,
    );
    expect(tl.duration).toBeCloseTo(30);
    const aEnd = layout(a, endState(tl, 'a')!, d);
    const aAt25 = tl.sample(25).get('a')!;
    aEnd.forEach((f, i) => expect(aAt25[i].pos.y).toBeCloseTo(f.pos.y));
  });

  it('sample is continuous across a march → wheel boundary', () => {
    const a = company('a');
    const tl = execute(
      [{ company: a, start: line(a), orders: [o('march', { paces: 10, step: 'ordinary' }), o('wheel', { direction: 'right', degrees: 90, by: 'company' })] }],
      d,
    );
    const t1 = tl.segments.get('a')![0].t1;
    const before = tl.sample(t1 - 1e-6).get('a')!;
    const after = tl.sample(t1 + 1e-6).get('a')!;
    before.forEach((f, i) => expect(dist(f.pos, after[i].pos)).toBeLessThan(0.01));
  });

  it('stops at the first invalid order', () => {
    const a = company('a');
    const tl = execute(
      [
        {
          company: a,
          start: line(a),
          orders: [
            o('face', { direction: 'right' }),
            o('wheel', { direction: 'right', degrees: 90, by: 'company' }),
            o('march', { paces: 10, step: 'ordinary' }),
          ],
        },
      ],
      d,
    );
    const segs = tl.segments.get('a')!;
    expect(segs).toHaveLength(2);
    expect(segs[1].error).toBeTruthy();
    expect(tl.duration).toBeCloseTo(segs[0].t1);
  });

  it('path traces the front-rank centre, so a right wheel dressed by the right still shows an arc', () => {
    const a = company('a', [36, 36]);
    const start = line(a);
    const tl = execute([{ company: a, start, orders: [o('wheel', { direction: 'right', degrees: 90, by: 'company' })] }], d);
    const path = tl.path('a');
    const travelled = path.slice(1).reduce((sum, p, i) => sum + dist(p, path[i]), 0);
    const halfFront = (23 * 0.75) / 2;
    expect(travelled).toBeGreaterThan(0.95 * halfFront * (Math.PI / 2));
  });

  it('path follows the wheel along an arc and ends at the end front-rank centre', () => {
    const a = company('a', [36, 36]);
    const start = line(a);
    const tl = execute(
      [{ company: a, start, orders: [o('wheel', { direction: 'left', degrees: 90, by: 'company' }), o('march', { paces: 10, step: 'ordinary' })] }],
      d,
    );
    const path = tl.path('a');
    const g0 = lineAnchor(start, d);
    const g1 = lineAnchor(endState(tl, 'a')!, d);
    expect(dist(path[0], g0)).toBeLessThan(1e-6);
    expect(dist(path[path.length - 1], g1)).toBeLessThan(1e-6);
    // the right flank swings around the left-flank pivot: some point lies well off the chord
    const chordMid = { x: (g0.x + g1.x) / 2, y: (g0.y + g1.y) / 2 };
    expect(Math.max(...path.map((p) => dist(p, chordMid)))).toBeGreaterThan(5);
  });

  it('executes 10 companies × 100 men × 20 orders within a frame', () => {
    const kinds: Order[] = [
      o('march', { paces: 10, step: 'ordinary' }),
      o('wheel', { direction: 'right', degrees: 90, by: 'platoons' }),
      o('wheel', { direction: 'left', degrees: 90, by: 'platoons' }),
      o('spacing', { order: 'open' }),
      o('spacing', { order: 'close' }),
    ];
    const input = Array.from({ length: 10 }, (_, i) => {
      const c = company(`c${i}`, [50, 50]);
      return { company: c, start: line(c, i * 50), orders: Array.from({ length: 20 }, (_, k) => kinds[k % kinds.length]) };
    });
    // Warm the JIT, then take the best of several runs so shared CI runners' noise doesn't decide the result.
    execute(input, d);
    let best = Infinity;
    for (let i = 0; i < 5; i++) {
      const t = performance.now();
      execute(input, d);
      best = Math.min(best, performance.now() - t);
    }
    expect(best).toBeLessThan(16);
  });
});

describe('compareToGhost', () => {
  const c = company('a');
  const tol = { paces: 2, degrees: 5 };

  it('identical states pass', () => {
    const r = compareToGhost(c, line(c), line(c), d, tol);
    expect(r.pass).toBe(true);
    expect(r.distance).toBeCloseTo(0);
    expect(r.mismatches).toEqual([]);
  });

  it('three paces off fails', () => {
    const r = compareToGhost(c, line(c), translateState(line(c), { x: 0, y: 3 }), d, tol);
    expect(r.pass).toBe(false);
    expect(r.distance).toBeCloseTo(3);
  });

  it('names a dressing mismatch', () => {
    const ghost = { ...line(c), dressBy: 'left' as const };
    const r = compareToGhost(c, line(c), ghost, d, tol);
    expect(r.mismatches).toContain('dress: right (ghost: left)');
  });
});
