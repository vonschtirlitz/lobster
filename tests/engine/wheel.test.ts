import { buildSegment } from '../../src/engine/primitives';
import { asLine, describe as describeState } from '../../src/model/formation';
import { gb1764 as d } from '../../src/drill/gb1764';
import { makeCompany } from '../helpers';
import { dist } from '../../src/model/vec';
import type { FormationState, Order } from '../../src/model/types';

const up = Math.PI / 2;
const c = makeCompany([36, 36]); // 24 files, 3 deep
const start = asLine(c, { x: 0, y: 0 }, up, 3, 'close', 'right', d);
const wheel = (direction: string, by: string, degrees = 90): Order => ({
  id: 'w',
  kind: 'wheel',
  params: { direction, by, degrees },
});
const at = (figs: ReturnType<ReturnType<typeof buildSegment>['sample']>, slot: string) =>
  figs.find((f) => f.slot === slot)!.pos;

describe('wheel', () => {
  it('a right wheel by company pivots on the right-flank man', () => {
    const seg = buildSegment(wheel('right', 'company'), 0, start, c, d);
    expect(seg.error).toBeUndefined();
    const pivot0 = at(seg.sample(0), 'p0:f0:r0');
    for (const t of [seg.t1 / 2, seg.t1]) {
      const p = at(seg.sample(t), 'p0:f0:r0');
      expect(p.x).toBeCloseTo(pivot0.x);
      expect(p.y).toBeCloseTo(pivot0.y);
    }
    expect(seg.end.blocks[0].front).toBeCloseTo(0);
    expect(seg.t1).toBeCloseTo((23 * 0.75 * (Math.PI / 2)) / 1);
  });

  it('the wheeling flank follows an arc, not a straight line', () => {
    const seg = buildSegment(wheel('right', 'company'), 0, start, c, d);
    const pivot = at(seg.sample(0), 'p0:f0:r0');
    const mid = at(seg.sample(seg.t1 / 2), 'p1:f11:r0');
    expect(dist(mid, pivot)).toBeCloseTo(23 * 0.75);
    expect(mid.y).toBeGreaterThan(at(seg.sample(0), 'p1:f11:r0').y + 5);
  });

  it('platoons wheel from line into column and back into line', () => {
    const toColumn = buildSegment(wheel('right', 'platoons'), 0, start, c, d);
    expect(describeState(toColumn.end, d)).toBe('column');
    const toLine = buildSegment(wheel('left', 'platoons'), toColumn.t1, toColumn.end, c, d);
    expect(describeState(toLine.end, d)).toBe('line');
    expect(toLine.end.blocks[0].front).toBeCloseTo(up);
  });

  it('cannot wheel while faced to a flank', () => {
    const faced: FormationState = { ...start, menFacing: 'right' };
    const seg = buildSegment(wheel('right', 'company'), 2, faced, c, d);
    expect(seg.error).toBe('Cannot wheel while faced to a flank');
    expect(seg.t1).toBe(seg.t0);
  });

  it('a company must be in line to wheel as one', () => {
    const column = buildSegment(wheel('right', 'platoons'), 0, start, c, d).end;
    const seg = buildSegment(wheel('right', 'company'), 0, column, c, d);
    expect(seg.error).toBe('Company must be in line to wheel as one');
  });
});
