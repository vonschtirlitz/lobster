import { fwd, right, rotateAbout, angleDiff } from '../../src/model/vec';

describe('vec', () => {
  it('fwd and right follow the y-up convention', () => {
    const f = fwd(Math.PI / 2);
    expect(f.x).toBeCloseTo(0);
    expect(f.y).toBeCloseTo(1);
    const r = right(Math.PI / 2);
    expect(r.x).toBeCloseTo(1);
    expect(r.y).toBeCloseTo(0);
  });

  it('rotateAbout rotates counter-clockwise for positive angles', () => {
    const p = rotateAbout({ x: 1, y: 0 }, { x: 0, y: 0 }, Math.PI / 2);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(1);
  });

  it('angleDiff wraps across zero', () => {
    expect(angleDiff(0.1, 2 * Math.PI - 0.1)).toBeCloseTo(0.2);
  });
});
