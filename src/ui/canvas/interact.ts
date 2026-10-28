import type { Company, FormationState, Vec2 } from '../../model/types';
import type { DrillSystem } from '../../drill/types';
import type { Scene, Store, UiState } from '../../state/store';
import { getDrill } from '../../drill/registry';
import { flankPos } from '../../model/layout';
import {
  companyFront,
  companyRanks,
  frontageFromDrag,
  guidePoint,
  lineAnchor,
  resizeAboutDress,
  rotateState,
  translateState,
} from '../../model/formation';
import { dist, lerp, right, scale, sub } from '../../model/vec';
import type { Camera } from './camera';
import { blockCorners, rotateHandlePos, type Overlay } from './render';

export type HitKind = 'body' | 'rotate' | 'edgeL' | 'edgeR';
const HANDLE_PX = 10;

function inPolygon(p: Vec2, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function hitTest(scene: Scene, ui: UiState, cam: Camera, screenPt: Vec2): { kind: HitKind; companyId: string } | null {
  const d = getDrill(scene.drillId);
  const states = scene[ui.editTarget];
  const near = (world: Vec2) => dist(cam.worldToScreen(world), screenPt) <= HANDLE_PX;

  for (const id of ui.selected) {
    const s = states[id];
    const occ = s?.blocks.filter((b) => b.files > 0) ?? [];
    if (!occ.length) continue;
    const fi = d.defaults.fileInterval[s.order];
    if (near(rotateHandlePos(s, d))) return { kind: 'rotate', companyId: id };
    if (near(flankPos(occ[0], 'right', fi))) return { kind: 'edgeR', companyId: id };
    if (near(flankPos(occ[occ.length - 1], 'left', fi))) return { kind: 'edgeL', companyId: id };
  }

  const world = cam.screenToWorld(screenPt);
  for (let i = scene.companies.length - 1; i >= 0; i--) {
    const id = scene.companies[i].id;
    const s = states[id];
    if (!s) continue;
    if (s.blocks.some((b) => b.files > 0 && inPolygon(world, blockCorners(b, d, s.order)))) return { kind: 'body', companyId: id };
  }
  return null;
}

/** Re-form a line to the width set by dragging one flank handle, holding the dressing point and the front. */
export function edgeResize(c: Company, base: FormationState, side: 'left' | 'right', world: Vec2, d: DrillSystem) {
  const fi = d.defaults.fileInterval[base.order];
  const occ = base.blocks.filter((b) => b.files > 0);
  const R = flankPos(occ[0], 'right', fi);
  const L = flankPos(occ[occ.length - 1], 'left', fi);
  const dir = right(companyFront(base));
  const proj = (v: Vec2) => v.x * dir.x + v.y * dir.y;
  const width =
    base.dressBy === 'centre' ? 2 * Math.abs(proj(sub(world, lerp(R, L, 0.5)))) : side === 'right' ? proj(sub(world, L)) : proj(sub(R, world));
  // a minimum length keeps the drag's direction, and so the front, defined
  const r = frontageFromDrag(c, { x: 0, y: 0 }, scale(dir, Math.max(1e-3, width)), base, d);
  const held = base.dressBy === 'centre' ? lerp(R, L, 0.5) : guidePoint(c, base, d);
  const now = base.dressBy === 'centre' ? lineAnchor(r.state, d) : guidePoint(c, r.state, d);
  return { ...r, state: { ...translateState(r.state, sub(held, now)), menFacing: base.menFacing } };
}

const ARROWS: Record<string, Vec2> = {
  ArrowUp: { x: 0, y: 1 },
  ArrowDown: { x: 0, y: -1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

/** Keyboard equivalents of the field drags: arrows move, [ ] rotate, + - change depth. Null when the key does nothing. */
export function keyEdit(c: Company, s: FormationState, key: string, shift: boolean, d: DrillSystem): FormationState | null {
  if (ARROWS[key]) return translateState(s, scale(ARROWS[key], shift ? 10 : 1));
  if (key === '[' || key === ']') {
    const step = ((shift ? 45 : 5) * Math.PI) / 180;
    return rotateState(s, lineAnchor(s, d), key === '[' ? step : -step);
  }
  if (key === '+' || key === '=' || key === '-' || key === '_') {
    const allowed = [...d.defaults.allowedRanks].sort((a, b) => a - b);
    const i = allowed.indexOf(companyRanks(s));
    const next = allowed[key === '+' || key === '=' ? i - 1 : i + 1];
    return i < 0 || next === undefined ? null : resizeAboutDress(c, s, null, next, d);
  }
  return null;
}

type Drag =
  | { kind: 'pan'; last: Vec2 }
  | { kind: 'move'; start: Vec2; bases: Map<string, FormationState> }
  | { kind: 'rotate'; pivot: Vec2; startAngle: Vec2; bases: Map<string, FormationState> }
  | { kind: 'frontage'; id: string; a: Vec2; base: FormationState }
  | { kind: 'edge'; id: string; side: 'left' | 'right'; base: FormationState };

const SNAP = Math.PI / 4;

export function attachInteractions(canvas: HTMLCanvasElement, cam: Camera, store: Store, overlay: Overlay, invalidate: () => void) {
  let drag: Drag | null = null;
  let pending: { which: 'current' | 'ghost'; states: Map<string, FormationState>; toLine?: boolean } | null = null;

  const local = (e: PointerEvent | MouseEvent): Vec2 => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const setPreview = (states: Map<string, FormationState>, toLine = false) => {
    pending = { which: store.ui().editTarget, states, toLine };
    overlay.previews = [...states].map(([companyId, state]) => ({ companyId, state }));
    invalidate();
  };

  const selectionPivot = (bases: Map<string, FormationState>, d: ReturnType<typeof getDrill>) => {
    const pts = [...bases.values()].map((s) => lineAnchor(s, d));
    return scale(pts.reduce((a, b) => ({ x: a.x + b.x, y: a.y + b.y }), { x: 0, y: 0 }), 1 / Math.max(1, pts.length));
  };

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  canvas.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const scene = store.get();
    const ui = store.ui();
    if (e.key === 'Escape') {
      store.setUi({ selected: [] });
      return;
    }
    const d = getDrill(scene.drillId);
    const changes = ui.selected.flatMap((id) => {
      const c = scene.companies.find((x) => x.id === id);
      const s = scene[ui.editTarget][id];
      const next = c && s ? keyEdit(c, s, e.key, e.shiftKey, d) : null;
      return next ? [{ id, which: ui.editTarget, state: next }] : [];
    });
    if (!changes.length) return;
    e.preventDefault();
    store.dispatch({ type: 'setFormations', changes });
  });

  canvas.addEventListener('pointerdown', (e) => {
    const scene = store.get();
    const ui = store.ui();
    const d = getDrill(scene.drillId);
    const pt = local(e);
    const world = cam.screenToWorld(pt);
    const states = scene[ui.editTarget];
    canvas.setPointerCapture(e.pointerId);

    const wantsFrontage = e.button === 2 || (e.button === 0 && ui.tool === 'frontage');
    if (wantsFrontage && ui.selected.length === 1 && states[ui.selected[0]]) {
      drag = { kind: 'frontage', id: ui.selected[0], a: world, base: states[ui.selected[0]] };
      return;
    }
    if (e.button !== 0) return;

    const hit = hitTest(scene, ui, cam, pt);
    if (!hit) {
      if (!e.shiftKey) store.setUi({ selected: [] });
      drag = { kind: 'pan', last: pt };
      return;
    }
    if (e.shiftKey && hit.kind === 'body') {
      const sel = ui.selected.includes(hit.companyId)
        ? ui.selected.filter((x) => x !== hit.companyId)
        : [...ui.selected, hit.companyId];
      store.setUi({ selected: sel });
      return;
    }
    if (!ui.selected.includes(hit.companyId)) store.setUi({ selected: [hit.companyId] });
    const selected = store.ui().selected;
    const bases = new Map(selected.filter((id) => states[id]).map((id) => [id, states[id]]));

    if (hit.kind === 'body') drag = { kind: 'move', start: world, bases };
    else if (hit.kind === 'rotate') {
      const pivot = selectionPivot(bases, d);
      drag = { kind: 'rotate', pivot, startAngle: sub(world, pivot), bases };
    } else drag = { kind: 'edge', id: hit.companyId, side: hit.kind === 'edgeL' ? 'left' : 'right', base: states[hit.companyId] };
  });

  canvas.addEventListener('pointermove', (e) => {
    const pt = local(e);
    if (!drag) {
      const hit = hitTest(store.get(), store.ui(), cam, pt);
      canvas.style.cursor = !hit ? 'default' : hit.kind === 'body' ? 'move' : hit.kind === 'rotate' ? 'grab' : 'ew-resize';
      return;
    }
    const scene = store.get();
    const d = getDrill(scene.drillId);
    const world = cam.screenToWorld(pt);

    switch (drag.kind) {
      case 'pan':
        cam.pan(pt.x - drag.last.x, pt.y - drag.last.y);
        drag.last = pt;
        invalidate();
        break;
      case 'move': {
        const delta = sub(world, drag.start);
        setPreview(new Map([...drag.bases].map(([id, s]) => [id, translateState(s, delta)])));
        break;
      }
      case 'rotate': {
        const now = sub(world, drag.pivot);
        let angle = Math.atan2(now.y, now.x) - Math.atan2(drag.startAngle.y, drag.startAngle.x);
        if (e.shiftKey) {
          const front0 = companyFront([...drag.bases.values()][0]);
          angle = Math.round((front0 + angle) / SNAP) * SNAP - front0;
        }
        const pivot = drag.pivot;
        setPreview(new Map([...drag.bases].map(([id, s]) => [id, rotateState(s, pivot, angle)])));
        break;
      }
      case 'frontage': {
        const c = scene.companies.find((x) => x.id === (drag as { id: string }).id);
        if (!c) break;
        const r = frontageFromDrag(c, drag.a, world, drag.base, d);
        overlay.frontage = { a: drag.a, b: world, label: `${r.files} ${d.terms.files} × ${r.ranks} ${d.terms.ranks}`, note: r.note };
        setPreview(new Map([[c.id, r.state]]), true);
        break;
      }
      case 'edge': {
        const c = scene.companies.find((x) => x.id === (drag as { id: string }).id);
        if (!c) break;
        const r = edgeResize(c, drag.base, drag.side, world, d);
        const state = r.state;
        const fi = d.defaults.fileInterval[drag.base.order];
        const occ = drag.base.blocks.filter((b) => b.files > 0);
        const R = flankPos(occ[0], 'right', fi);
        const L = flankPos(occ[occ.length - 1], 'left', fi);
        overlay.frontage = { a: R, b: L, label: `${r.files} ${d.terms.files} × ${r.ranks} ${d.terms.ranks}`, note: r.note };
        setPreview(new Map([[c.id, state]]), true);
        break;
      }
    }
  });

  const finish = () => {
    if (pending && pending.states.size) {
      const { which, states, toLine } = pending;
      const scene = store.get();
      const changes = [...states].map(([id, state]) => ({ id, which, state }));
      const shapeChanges =
        toLine && which === 'ghost' ? changes.filter((ch) => scene.ghostShape[ch.id] === 'column').map((ch) => ch.id) : [];
      store.dispatch({ type: 'setFormations', changes, lineShapes: shapeChanges });
    }
    drag = null;
    pending = null;
    overlay.previews = [];
    overlay.frontage = undefined;
    invalidate();
  };
  canvas.addEventListener('pointerup', finish);
  canvas.addEventListener('pointercancel', finish);

  window.addEventListener('keydown', (e) => {
    const target = e.target as HTMLElement | null;
    if (target && /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) store.redo();
      else store.undo();
    } else if (mod && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      store.redo();
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && store.ui().selected.length) {
      e.preventDefault();
      for (const id of store.ui().selected) store.dispatch({ type: 'removeCompany', id });
    }
  });
}
