import { layout } from '../../src/model/layout';
import { gb1764 } from '../../src/drill/gb1764';
import { makeCompany, twoPlatoonLine } from '../helpers';
import type { FormationState } from '../../src/model/types';

const privates = (figs: ReturnType<typeof layout>) => figs.filter((f) => f.role === 'private');

describe('layout', () => {
  it('lays out two 12-man platoons three deep facing up', () => {
    const figs = privates(layout(makeCompany([12, 12]), twoPlatoonLine(), gb1764));
    expect(figs).toHaveLength(24);
    const front = figs.filter((f) => f.slot.endsWith(':r0'));
    const rear = figs.filter((f) => f.slot.endsWith(':r2'));
    front.forEach((f) => expect(f.pos.y).toBeCloseTo(0));
    rear.forEach((f) => expect(f.pos.y).toBeCloseTo(-2));
    const maxX = Math.max(...figs.map((f) => f.pos.x));
    const rightFlank = figs.find((f) => f.slot === 'p0:f0:r0')!;
    expect(rightFlank.pos.x).toBeCloseTo(maxX);
    figs.forEach((f) => expect(f.facing).toBeCloseTo(Math.PI / 2));
  });

  it('men faced to the right face along +x', () => {
    const s: FormationState = { ...twoPlatoonLine(), menFacing: 'right' };
    privates(layout(makeCompany([12, 12]), s, gb1764)).forEach((f) => expect(f.facing).toBeCloseTo(0));
  });

  it('dressed by the right, the short file is the platoon\'s leftmost file', () => {
    const s = twoPlatoonLine();
    s.blocks[0].files = 5; // 13 men, 3 deep
    const figs = privates(layout(makeCompany([13, 12]), s, gb1764)).filter((f) => f.platoonId === 'p0');
    expect(figs).toHaveLength(13);
    const inFile = (f: number) => figs.filter((x) => x.slot.includes(`:f${f}:`)).length;
    expect(inFile(4)).toBe(1);
    expect(inFile(0)).toBe(3);
  });

  it('dressed by the left, the short file is the platoon\'s rightmost file', () => {
    const s = { ...twoPlatoonLine(), dressBy: 'left' as const };
    s.blocks = s.blocks.map((b, i) => (i === 0 ? { ...b, files: 5 } : b));
    const figs = privates(layout(makeCompany([13, 12]), s, gb1764)).filter((f) => f.platoonId === 'p0');
    const inFile = (f: number) => figs.filter((x) => x.slot.includes(`:f${f}:`)).length;
    expect(inFile(0)).toBe(1);
    expect(inFile(4)).toBe(3);
  });

  it('layout tolerates platoon sum mismatch', () => {
    const c = makeCompany([10, 10], { rankAndFile: 30 });
    const s = twoPlatoonLine();
    expect(() => layout(c, s, gb1764)).not.toThrow();
    expect(privates(layout(c, s, gb1764))).toHaveLength(20);
  });

  it('degenerate companies', () => {
    const one = makeCompany([1]);
    const s: FormationState = {
      blocks: [{ platoonId: 'p0', anchor: { x: 0, y: 0 }, front: Math.PI / 2, files: 1, ranks: 3 }],
      menFacing: 'front',
      order: 'close',
      dressBy: 'right',
    };
    const figs = privates(layout(one, s, gb1764));
    expect(figs).toHaveLength(1);
    expect(Number.isFinite(figs[0].pos.x) && Number.isFinite(figs[0].pos.y)).toBe(true);

    const empty = makeCompany([1, 0]);
    const s2: FormationState = {
      ...s,
      blocks: [...s.blocks, { platoonId: 'p1', anchor: { x: -1, y: 0 }, front: Math.PI / 2, files: 0, ranks: 3 }],
    };
    const figs2 = layout(empty, s2, gb1764);
    expect(privates(figs2)).toHaveLength(1);
    figs2.forEach((f) => expect(Number.isFinite(f.pos.x) && Number.isFinite(f.pos.y)).toBe(true));
  });

  it('posts the captain in front of the front rank', () => {
    const c = makeCompany([12, 12], { officers: { captain: true, lieutenant: false, ensign: false } });
    const capt = layout(c, twoPlatoonLine(), gb1764).filter((f) => f.role === 'captain');
    expect(capt).toHaveLength(1);
    expect(capt[0].pos.y).toBeGreaterThan(0);
  });
});
