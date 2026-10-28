import { edgeResize, hitTest, keyEdit } from '../../src/ui/canvas/interact';
import { Camera } from '../../src/ui/canvas/camera';
import { defaultScene, type UiState } from '../../src/state/store';
import { layout } from '../../src/model/layout';
import { asLine, lineAnchor } from '../../src/model/formation';
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

describe('edgeResize', () => {
  it('narrowing past the held flank keeps the company facing the same way', () => {
    const east = asLine(c, { x: 0, y: 0 }, 0, 3, 'close', 'right', d);
    const far = { x: 0, y: -100 }; // well beyond the right flank (right hand points to -y when facing east)
    const r = edgeResize(c, east, 'left', far, d);
    expect(r.state.blocks[0].front).toBeCloseTo(0);
    expect(r.files).toBeGreaterThan(0);
  });
});

describe('keyEdit', () => {
  const line = () => asLine(c, { x: 0, y: 0 }, 0, 3, 'close', 'right', d);
  const files = (s: ReturnType<typeof line>) => s.blocks.reduce((n, b) => n + b.files, 0);
  const rightFlank = (s: ReturnType<typeof line>) => layout(c, s, d).find((f) => f.slot === 'p0:f0:r0')!.pos;

  it('arrow keys move the formation one pace, Shift ten', () => {
    expect(keyEdit(c, line(), 'ArrowUp', false, d)!.blocks[0].anchor.y).toBeCloseTo(line().blocks[0].anchor.y + 1);
    expect(keyEdit(c, line(), 'ArrowLeft', true, d)!.blocks[0].anchor.x).toBeCloseTo(line().blocks[0].anchor.x - 10);
  });

  it('[ and ] rotate about the front-rank centre', () => {
    const turned = keyEdit(c, line(), ']', false, d)!;
    expect(turned.blocks[0].front).toBeCloseTo(-Math.PI / 36);
    expect(lineAnchor(turned, d).x).toBeCloseTo(lineAnchor(line(), d).x);
  });

  it('+ widens to the next shallower depth and - narrows to the next deeper, holding the dressing point', () => {
    const wider = keyEdit(c, line(), '+', false, d)!;
    expect(files(wider)).toBeGreaterThan(files(line()));
    expect(wider.blocks[0].front).toBeCloseTo(0);
    expect(rightFlank(wider).x).toBeCloseTo(rightFlank(line()).x);
    expect(rightFlank(wider).y).toBeCloseTo(rightFlank(line()).y);
    expect(files(keyEdit(c, wider, '-', false, d)!)).toBe(files(line()));
  });

  it('returns null at the depth limits', () => {
    expect(keyEdit(c, line(), '-', false, d)).toBeNull();
  });

  it('ignores other keys', () => {
    expect(keyEdit(c, line(), 'x', false, d)).toBeNull();
  });
});
