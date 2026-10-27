import { hitTest } from '../../src/ui/canvas/interact';
import { Camera } from '../../src/ui/canvas/camera';
import { defaultScene, type UiState } from '../../src/state/store';
import { layout } from '../../src/model/layout';
import { lineAnchor } from '../../src/model/formation';
import { getDrill } from '../../src/drill/registry';

const scene = defaultScene();
const d = getDrill(scene.drillId);
const c = scene.companies[0];
const cam = new Camera();
cam.setViewport(800, 600);
const ui = (p: Partial<UiState> = {}): UiState => ({
  selected: [c.id],
  editTarget: 'current',
  tool: 'select',
  showGhost: true,
  ...p,
});
const S = (p: { x: number; y: number }) => cam.worldToScreen(p);

describe('hitTest', () => {
  it('the front-rank centre hits the body', () => {
    expect(hitTest(scene, ui(), cam, S(lineAnchor(scene.current[c.id], d)))).toEqual({ kind: 'body', companyId: c.id });
  });

  it('two paces in front of the centre hits the rotate handle', () => {
    const a = lineAnchor(scene.current[c.id], d);
    expect(hitTest(scene, ui(), cam, S({ x: a.x, y: a.y + 2 }))?.kind).toBe('rotate');
  });

  it('the left-flank man hits the left edge handle', () => {
    const figs = layout(c, scene.current[c.id], d).filter((f) => f.role === 'private');
    const leftmost = figs.reduce((m, f) => (f.pos.x < m.pos.x ? f : m));
    const front = figs.filter((f) => f.slot.endsWith(':r0')).reduce((m, f) => (f.pos.x < m.pos.x ? f : m));
    expect(leftmost.pos.x).toBeCloseTo(front.pos.x);
    expect(hitTest(scene, ui(), cam, S(front.pos))?.kind).toBe('edgeL');
  });

  it('far away hits nothing', () => {
    expect(hitTest(scene, ui(), cam, S({ x: 400, y: 400 }))).toBeNull();
  });

  it('when editing the ghost, the current block is not hit', () => {
    const r = hitTest(scene, ui({ editTarget: 'ghost', selected: [] }), cam, S(lineAnchor(scene.current[c.id], d)));
    expect(r).toBeNull();
  });
});
