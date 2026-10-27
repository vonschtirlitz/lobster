import { buildSegment } from '../../src/engine/primitives';
import { asLine } from '../../src/model/formation';
import { layout } from '../../src/model/layout';
import { gb1764 as d } from '../../src/drill/gb1764';
import { makeCompany } from '../helpers';
import type { Order } from '../../src/model/types';
import type { CommandKind } from '../../src/drill/types';

const up = Math.PI / 2;
const c = makeCompany([12, 12]);
const start = asLine(c, { x: 0, y: 0 }, up, 3, 'close', 'right', d);
const o = (kind: CommandKind, params: Record<string, unknown> = {}): Order => ({ id: kind, kind, params });
const man = (figs: ReturnType<typeof layout>) => figs.find((f) => f.slot === 'p0:f0:r0')!;

describe('simple primitives', () => {
  it('right face turns the men clockwise over one beat', () => {
    const seg = buildSegment(o('face', { direction: 'right' }), 0, start, c, d);
    expect(seg.error).toBeUndefined();
    expect(seg.end.menFacing).toBe('right');
    expect(seg.t1).toBe(d.defaults.beatSeconds);
    expect(man(seg.sample(d.defaults.beatSeconds / 2)).facing).toBeCloseTo(Math.PI / 4);
  });

  it('march 20 at the ordinary step moves the block 20 paces to its front in 20 s', () => {
    const seg = buildSegment(o('march', { paces: 20, step: 'ordinary' }), 0, start, c, d);
    expect(seg.t1).toBeCloseTo(20);
    const a = layout(c, start, d);
    const b = seg.sample(20);
    a.forEach((f, i) => {
      expect(b[i].pos.x).toBeCloseTo(f.pos.x);
      expect(b[i].pos.y).toBeCloseTo(f.pos.y + 20);
    });
  });

  it('right face, march 20, front is a flank march of 20 paces to the right', () => {
    const s1 = buildSegment(o('face', { direction: 'right' }), 0, start, c, d);
    const s2 = buildSegment(o('march', { paces: 20, step: 'ordinary' }), s1.t1, s1.end, c, d);
    const s3 = buildSegment(o('face', { direction: 'front' }), s2.t1, s2.end, c, d);
    expect(s3.end.menFacing).toBe('front');
    const before = man(layout(c, start, d)).pos;
    const after = man(layout(c, s3.end, d)).pos;
    expect(after.x - before.x).toBeCloseTo(20);
    expect(after.y - before.y).toBeCloseTo(0);
  });

  it('wait holds every man still for its duration', () => {
    const seg = buildSegment(o('wait', { seconds: 4 }), 3, start, c, d);
    expect(seg.t1 - seg.t0).toBe(4);
    expect(seg.sample(7)).toEqual(seg.sample(3));
  });

  it('dress changes the dressing point without moving anyone', () => {
    const seg = buildSegment(o('dress', { point: 'left' }), 0, start, c, d);
    expect(seg.end.dressBy).toBe('left');
    expect(man(seg.sample(seg.t1)).pos.x).toBeCloseTo(man(layout(c, start, d)).pos.x);
  });

  it('an unknown command is an error segment of zero length', () => {
    const seg = buildSegment(o('fire' as CommandKind), 5, start, c, d);
    expect(seg.error).toBe('Unknown command');
    expect(seg.t1).toBe(5);
    expect(seg.end).toBe(start);
  });
});
