import {
  asLine,
  asColumnOfPlatoons,
  describe as describeState,
  frontageFromDrag,
  guidePoint,
  resizeAboutDress,
  translateState,
} from '../../src/model/formation';
import { layout } from '../../src/model/layout';
import { gb1764 as d } from '../../src/drill/gb1764';
import { makeCompany } from '../helpers';
import type { DressPoint, FormationState } from '../../src/model/types';

const up = Math.PI / 2;
const c = makeCompany([12, 12]);
const line = (dress: DressPoint = 'right') => asLine(c, { x: 0, y: 0 }, up, 3, 'close', dress, d);
const slot = (s: FormationState, id: string) => layout(c, s, d).find((f) => f.slot === id)!.pos;

describe('formation helpers', () => {
  it('asLine builds a line, shoulder to shoulder', () => {
    const s = line();
    expect(describeState(s, d)).toBe('line');
    // 8 files in all, 0.75 apart: right flank at +2.625
    expect(slot(s, 'p0:f0:r0').x).toBeCloseTo(2.625);
    expect(slot(s, 'p1:f3:r0').x).toBeCloseTo(-2.625);
  });

  it('asColumnOfPlatoons builds a column', () => {
    const s = asColumnOfPlatoons(c, { x: 0, y: 0 }, up, 3, 'close', 'right', d);
    expect(describeState(s, d)).toBe('column');
  });

  it('moving one block makes it irregular', () => {
    const s = line();
    s.blocks[1] = translateState({ ...s, blocks: [s.blocks[1]] }, { x: 3, y: 5 }).blocks[0];
    expect(describeState(s, d)).toBe('irregular');
  });

  it('frontageFromDrag faces left of the drag direction and keeps the files actually formed', () => {
    const r = frontageFromDrag(c, { x: 0, y: 0 }, { x: 10, y: 0 }, line(), d);
    expect(r.state.blocks[0].front).toBeCloseTo(up);
    expect(r.ranks).toBe(2);
    expect(r.files).toBe(12);
    expect(r.note).toBeUndefined();
  });

  it('a narrow drag snaps to the deepest allowed ranks with a note', () => {
    const r = frontageFromDrag(c, { x: 0, y: 0 }, { x: 1, y: 0 }, line(), d);
    expect(r.ranks).toBe(3);
    expect(r.note).toMatch(/3 ranks/);
  });

  it('frontage clamps', () => {
    const one = makeCompany([1]);
    const start = asLine(one, { x: 0, y: 0 }, up, 3, 'close', 'right', d);
    const r = frontageFromDrag(one, { x: 0, y: 0 }, { x: 100, y: 0 }, start, d);
    expect(r.files).toBe(1);
    expect(r.ranks).toBe(2);
    layout(one, r.state, d).forEach((f) => expect(Number.isFinite(f.pos.x)).toBe(true));
  });

  it('opening order dressed by the right holds the right flank', () => {
    const s = line('right');
    const open = resizeAboutDress(c, s, 'extended', null, d);
    expect(slot(open, 'p0:f0:r0').x).toBeCloseTo(slot(s, 'p0:f0:r0').x);
    expect(slot(open, 'p0:f0:r0').y).toBeCloseTo(slot(s, 'p0:f0:r0').y);
    expect(slot(open, 'p1:f3:r0').x).toBeLessThan(slot(s, 'p1:f3:r0').x - 1);
  });

  it('opening order dressed by the centre holds the centre', () => {
    const s = line('centre');
    const open = resizeAboutDress(c, s, 'extended', null, d);
    expect(guidePoint(c, open, d).x).toBeCloseTo(0);
    expect(slot(open, 'p0:f0:r0').x).toBeGreaterThan(slot(s, 'p0:f0:r0').x + 1);
  });

  it('opening order dressed by the left holds the left flank', () => {
    const s = line('left');
    const open = resizeAboutDress(c, s, 'extended', null, d);
    expect(slot(open, 'p1:f3:r0').x).toBeCloseTo(slot(s, 'p1:f3:r0').x);
  });

  it('guidePoint dressed by the right is the right-flank front-rank man', () => {
    const s = line('right');
    const g = guidePoint(c, s, d);
    expect(g.x).toBeCloseTo(slot(s, 'p0:f0:r0').x);
    expect(g.y).toBeCloseTo(slot(s, 'p0:f0:r0').y);
  });
});
