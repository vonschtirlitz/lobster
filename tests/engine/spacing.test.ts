import { buildSegment, depthMatch } from '../../src/engine/primitives';
import { asLine, guidePoint } from '../../src/model/formation';
import { layout } from '../../src/model/layout';
import { gb1764 as d } from '../../src/drill/gb1764';
import { makeCompany } from '../helpers';
import type { DressPoint, Order } from '../../src/model/types';
import type { CommandKind } from '../../src/drill/types';

const up = Math.PI / 2;
const c = makeCompany([12, 12]);
const line = (dress: DressPoint = 'right') => asLine(c, { x: 0, y: 0 }, up, 3, 'close', dress, d);
const o = (kind: CommandKind, params: Record<string, unknown>): Order => ({ id: kind, kind, params });
const pos = (figs: ReturnType<typeof layout>, slot: string) => figs.find((f) => f.slot === slot)!.pos;

describe('spacing and depth', () => {
  it('open order dressed by the right holds the right-flank man and opens the ranks', () => {
    const s = line('right');
    const seg = buildSegment(o('spacing', { order: 'open' }), 0, s, c, d);
    expect(seg.error).toBeUndefined();
    const end = seg.sample(seg.t1);
    expect(pos(end, 'p0:f0:r0').x).toBeCloseTo(pos(layout(c, s, d), 'p0:f0:r0').x);
    expect(pos(end, 'p0:f0:r0').y).toBeCloseTo(pos(end, 'p0:f0:r2').y + 4);
    expect(seg.t1).toBeGreaterThan(0);
  });

  it('extended order dressed by the left holds the left-flank man', () => {
    const s = line('left');
    const seg = buildSegment(o('spacing', { order: 'extended' }), 0, s, c, d);
    expect(pos(seg.sample(seg.t1), 'p1:f3:r0').x).toBeCloseTo(pos(layout(c, s, d), 'p1:f3:r0').x);
  });

  it('forming two deep re-forms 24 men on 12 files, every man matched once, guide held', () => {
    const s = line('right');
    const seg = buildSegment(o('depth', { ranks: '2' }), 0, s, c, d);
    expect(seg.error).toBeUndefined();
    expect(seg.end.blocks.reduce((n, b) => n + b.files, 0)).toBe(12);
    const a = layout(c, s, d).filter((f) => f.role === 'private');
    const b = layout(c, seg.end, d).filter((f) => f.role === 'private');
    const m = depthMatch(a, b);
    expect(new Set(a.map((f) => m.get(f.slot))).size).toBe(24);
    const g0 = guidePoint(c, s, d);
    const g1 = guidePoint(c, seg.end, d);
    expect(g1.x).toBeCloseTo(g0.x);
    expect(g1.y).toBeCloseTo(g0.y);
  });

  it('rejects bad params', () => {
    const s = line();
    expect(buildSegment(o('wheel', { direction: 'right', degrees: 0, by: 'company' }), 0, s, c, d).error).toMatch(/Degrees/);
    expect(buildSegment(o('march', { paces: -5, step: 'ordinary' }), 0, s, c, d).error).toMatch(/Paces/);
    expect(buildSegment(o('spacing', { order: 'skirmish' }), 0, s, c, d).error).toMatch(/Order/);
    expect(buildSegment(o('depth', { ranks: '4' }), 0, s, c, d).error).toMatch(/Ranks/);
  });
});
