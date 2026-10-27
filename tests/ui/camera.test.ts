import { Camera } from '../../src/ui/canvas/camera';

describe('camera', () => {
  it('screenToWorld inverts worldToScreen', () => {
    const cam = new Camera();
    cam.setViewport(800, 600);
    cam.pan(37, -12);
    cam.zoomAt({ x: 100, y: 200 }, 1.7);
    const p = { x: 12.5, y: -3 };
    const q = cam.screenToWorld(cam.worldToScreen(p));
    expect(q.x).toBeCloseTo(p.x);
    expect(q.y).toBeCloseTo(p.y);
  });

  it('world y points up the screen', () => {
    const cam = new Camera();
    cam.setViewport(800, 600);
    expect(cam.worldToScreen({ x: 0, y: 1 }).y).toBeLessThan(cam.worldToScreen({ x: 0, y: 0 }).y);
  });

  it('zoomAt keeps the point under the cursor fixed', () => {
    const cam = new Camera();
    cam.setViewport(800, 600);
    const cursor = { x: 250, y: 120 };
    const before = cam.screenToWorld(cursor);
    cam.zoomAt(cursor, 2.5);
    const after = cam.screenToWorld(cursor);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it('fit puts the bounds inside the viewport', () => {
    const cam = new Camera();
    cam.setViewport(800, 600);
    cam.fit({ minX: -50, minY: -20, maxX: 150, maxY: 80 });
    for (const p of [{ x: -50, y: -20 }, { x: 150, y: 80 }]) {
      const s = cam.worldToScreen(p);
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(800);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThanOrEqual(600);
    }
  });
});
