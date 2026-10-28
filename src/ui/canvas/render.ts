import type { Block, Company, Figure, FormationState, Vec2 } from '../../model/types';
import type { DrillSystem } from '../../drill/types';
import type { Store } from '../../state/store';
import type { Replay } from '../../state/replay';
import { getDrill } from '../../drill/registry';
import { layout, flankPos } from '../../model/layout';
import { companyFront, guidePoint, lineAnchor } from '../../model/formation';
import { add, fwd, right, scale, sub } from '../../model/vec';
import type { Camera } from './camera';
import { platoonColour } from '../colour';

export interface Palette {
  field: string;
  grid: string;
  gridMajor: string;
  ink: string;
  muted: string;
  select: string;
  error: string;
}

export function readPalette(el: Element): Palette {
  const cs = getComputedStyle(el);
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    field: v('--field', '#e7e3d4'),
    grid: v('--grid', 'rgba(60,60,40,0.10)'),
    gridMajor: v('--grid-major', 'rgba(60,60,40,0.22)'),
    ink: v('--ink', '#2b2a26'),
    muted: v('--muted', '#6b675c'),
    select: v('--select', '#1d5fa8'),
    error: v('--error', '#b3261e'),
  };
}

/** Transient drawing supplied by the interaction layer during a drag. */
export interface Overlay {
  previews: { companyId: string; state: FormationState }[];
  frontage?: { a: Vec2; b: Vec2; label: string; note?: string };
}

export const ROTATE_HANDLE_PACES = 2;
const LOD_ZOOM = 4; // px per pace below which men are drawn as plain specks

const platoonShade = (c: Company, platoonId: string | undefined, pal: Palette) =>
  platoonColour(c.colour, Math.max(0, c.platoons.findIndex((p) => p.id === platoonId)), pal.field, pal.ink);

/** The company colour adjusted to stay visible on the field in the current theme. */
const companyInk = (c: Company, pal: Palette) => platoonColour(c.colour, 0, pal.field, pal.ink);

/** Corners of a block's footprint (front-right, front-left, rear-left, rear-right), padded half a file. */
export function blockCorners(b: Block, d: DrillSystem, order: FormationState['order']): Vec2[] {
  const fi = d.defaults.fileInterval[order];
  const rd = d.defaults.rankDistance[order];
  const pad = Math.max(fi, 0.6) / 2;
  const r = right(b.front);
  const f = fwd(b.front);
  const depth = Math.max(0, b.ranks - 1) * rd;
  const fr = add(add(flankPos(b, 'right', fi), scale(r, pad)), scale(f, pad));
  const fl = add(add(flankPos(b, 'left', fi), scale(r, -pad)), scale(f, pad));
  return [fr, fl, add(fl, scale(f, -depth - 2 * pad)), add(fr, scale(f, -depth - 2 * pad))];
}

export const rotateHandlePos = (s: FormationState, d: DrillSystem): Vec2 =>
  add(lineAnchor(s, d), scale(fwd(companyFront(s)), ROTATE_HANDLE_PACES));

export function drawScene(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  store: Store,
  replay: Replay,
  pal: Palette,
  overlay: Overlay,
) {
  const scene = store.get();
  const ui = store.ui();
  const d = getDrill(scene.drillId);
  const tl = replay.timeline();
  const t = replay.t();
  const animating = replay.playing() || t > 0;
  const W = cam.width;
  const H = cam.height;
  const S = (p: Vec2) => cam.worldToScreen(p);
  const px = (paces: number) => paces * cam.zoom;

  ctx.fillStyle = pal.field;
  ctx.fillRect(0, 0, W, H);
  drawGrid(ctx, cam, pal);

  const previewFor = new Map(overlay.previews.map((p) => [p.companyId, p.state]));
  const sampled = animating ? tl.sample(t) : null;

  for (const c of scene.companies) {
    const current = scene.current[c.id];
    const ghost = scene.ghost[c.id];
    if (!current || !ghost) continue;
    const orders = scene.orders[c.id] ?? [];
    const editingGhost = ui.editTarget === 'ghost';
    const shownGhost = editingGhost ? previewFor.get(c.id) ?? ghost : ghost;
    const shownCurrent = !editingGhost ? previewFor.get(c.id) ?? current : current;

    if (orders.length === 0) {
      dashedLine(ctx, S(guidePoint(c, shownCurrent, d)), S(guidePoint(c, shownGhost, d)), pal.muted, [4, 6], 1.25);
    } else {
      drawArrow(ctx, cam, c, tl, pal);
    }

    if (ui.showGhost) {
      ctx.save();
      ctx.globalAlpha = 0.35;
      drawFigures(ctx, cam, c, layout(c, shownGhost, d), pal);
      ctx.restore();
      ctx.save();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = companyInk(c, pal);
      ctx.globalAlpha = 0.8;
      ctx.lineWidth = 1;
      for (const b of shownGhost.blocks) if (b.files > 0) polygon(ctx, blockCorners(b, d, shownGhost.order).map(S), false);
      ctx.restore();
      drawGuide(ctx, cam, c, shownGhost, d, 0.5, pal);
    }

    const figs = !editingGhost && previewFor.has(c.id) ? layout(c, shownCurrent, d) : sampled?.get(c.id) ?? layout(c, current, d);
    drawFigures(ctx, cam, c, figs, pal);
    if (!sampled) drawGuide(ctx, cam, c, shownCurrent, d, 1, pal);
    if (orders.length) drawOrderMarks(ctx, cam, c, tl, pal, d);

    if (ui.selected.includes(c.id)) {
      const s = editingGhost ? shownGhost : shownCurrent;
      ctx.save();
      ctx.strokeStyle = pal.select;
      ctx.lineWidth = 1.5;
      for (const b of s.blocks) if (b.files > 0) polygon(ctx, blockCorners(b, d, s.order).map(S), false);
      const fi = d.defaults.fileInterval[s.order];
      const occ = s.blocks.filter((b) => b.files > 0);
      if (occ.length) {
        const handle = S(rotateHandlePos(s, d));
        const anchor = S(lineAnchor(s, d));
        ctx.beginPath();
        ctx.moveTo(anchor.x, anchor.y);
        ctx.lineTo(handle.x, handle.y);
        ctx.stroke();
        circle(ctx, handle, 5, pal.select, true);
        for (const p of [flankPos(occ[0], 'right', fi), flankPos(occ[occ.length - 1], 'left', fi)]) {
          const q = S(p);
          ctx.fillStyle = pal.select;
          ctx.fillRect(q.x - 4, q.y - 4, 8, 8);
        }
      }
      ctx.restore();
    }
  }

  if (overlay.frontage) {
    const { a, b, label, note } = overlay.frontage;
    const A = S(a);
    const B = S(b);
    ctx.save();
    ctx.strokeStyle = pal.select;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(A.x, A.y);
    ctx.lineTo(B.x, B.y);
    ctx.stroke();
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = pal.ink;
    ctx.fillText(label, B.x + 10, B.y - 8);
    if (note) {
      ctx.fillStyle = pal.error;
      ctx.fillText(note, B.x + 10, B.y + 10);
    }
    ctx.restore();
  }

  if (scene.companies.length === 0) {
    ctx.save();
    ctx.fillStyle = pal.ink;
    ctx.textAlign = 'center';
    ctx.font = '600 18px "EB Garamond", Georgia, serif';
    ctx.fillText('The field is empty', W / 2, H / 2 - 10);
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText('Use "+ Add company" in the Companies panel to put a company on the field.', W / 2, H / 2 + 14);
    ctx.restore();
  }

  drawScaleBar(ctx, cam, pal, px);
}

function drawGrid(ctx: CanvasRenderingContext2D, cam: Camera, pal: Palette) {
  const step = cam.zoom * 10 >= 12 ? 10 : 50;
  const tl = cam.screenToWorld({ x: 0, y: 0 });
  const br = cam.screenToWorld({ x: cam.width, y: cam.height });
  ctx.lineWidth = 1;
  for (let x = Math.floor(tl.x / step) * step; x <= br.x; x += step) {
    ctx.strokeStyle = x % (step * 5) === 0 ? pal.gridMajor : pal.grid;
    const sx = Math.round(cam.worldToScreen({ x, y: 0 }).x) + 0.5;
    ctx.beginPath();
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, cam.height);
    ctx.stroke();
  }
  for (let y = Math.floor(br.y / step) * step; y <= tl.y; y += step) {
    ctx.strokeStyle = y % (step * 5) === 0 ? pal.gridMajor : pal.grid;
    const sy = Math.round(cam.worldToScreen({ x: 0, y }).y) + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, sy);
    ctx.lineTo(cam.width, sy);
    ctx.stroke();
  }
}

function drawScaleBar(ctx: CanvasRenderingContext2D, cam: Camera, pal: Palette, px: (p: number) => number) {
  const paces = [5, 10, 25, 50, 100, 250].find((p) => px(p) >= 60) ?? 500;
  const x = 16;
  const y = cam.height - 18;
  ctx.save();
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y - 5);
  ctx.lineTo(x, y);
  ctx.lineTo(x + px(paces), y);
  ctx.lineTo(x + px(paces), y - 5);
  ctx.stroke();
  ctx.fillStyle = pal.ink;
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(`${paces} paces`, x + px(paces) + 8, y + 4);
  ctx.restore();
}

function drawFigures(ctx: CanvasRenderingContext2D, cam: Camera, c: Company, figs: Figure[], pal: Palette) {
  const z = cam.zoom;
  if (z < LOD_ZOOM) {
    for (const f of figs) {
      const p = cam.worldToScreen(f.pos);
      ctx.fillStyle = f.role === 'private' || f.role === 'corporal' ? platoonShade(c, f.platoonId, pal) : pal.ink;
      ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
    }
    return;
  }
  const r = Math.max(1.5, 0.3 * z);
  const tick = Math.max(3, 0.4 * z);
  for (const f of figs) {
    const p = cam.worldToScreen(f.pos);
    const shade = platoonShade(c, f.platoonId, pal);
    ctx.lineWidth = Math.max(1, z * 0.06);
    switch (f.role) {
      case 'private':
      case 'corporal':
        circle(ctx, p, r, shade, true);
        if (f.role === 'corporal') circle(ctx, p, r + 1.5, pal.ink, false);
        break;
      case 'sergeant': {
        const k = r * 1.3;
        ctx.fillStyle = pal.ink;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - k);
        ctx.lineTo(p.x + k, p.y);
        ctx.lineTo(p.x, p.y + k);
        ctx.lineTo(p.x - k, p.y);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'drummer':
        ctx.fillStyle = pal.ink;
        ctx.fillRect(p.x - r, p.y - r, 2 * r, 2 * r);
        break;
      default:
        circle(ctx, p, Math.max(2.5, 0.45 * z), companyInk(c, pal), false, Math.max(1.5, z * 0.12));
    }
    const dir = { x: Math.cos(f.facing), y: -Math.sin(f.facing) };
    const from = r * 0.6;
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = Math.max(1, z * 0.07);
    ctx.beginPath();
    ctx.moveTo(p.x + dir.x * from, p.y + dir.y * from);
    ctx.lineTo(p.x + dir.x * (from + tick), p.y + dir.y * (from + tick));
    ctx.stroke();
  }
}

function drawGuide(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  c: Company,
  s: FormationState,
  d: DrillSystem,
  alpha: number,
  pal: Palette,
) {
  if (!s.blocks.some((b) => b.files > 0)) return;
  const g = guidePoint(c, s, d);
  const front = companyFront(s);
  const k = Math.max(0.6, 7 / cam.zoom);
  const tip = add(g, scale(fwd(front), 1.8 + k));
  const base = add(g, scale(fwd(front), 1.8));
  const wing = scale(right(front), k * 0.6);
  const pts = [tip, add(base, wing), add(base, scale(wing, -1))].map((p) => cam.worldToScreen(p));
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = companyInk(c, pal);
  polygon(ctx, pts, true);
  ctx.restore();
}

function drawArrow(ctx: CanvasRenderingContext2D, cam: Camera, c: Company, tl: ReturnType<Replay['timeline']>, pal: Palette) {
  const colour = companyInk(c, pal);
  const path = tl.path(c.id).map((p) => cam.worldToScreen(p));
  if (path.length < 2) return;
  const width = Math.max(5, cam.zoom * 0.9);
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = colour;
  ctx.globalAlpha = 0.28;
  ctx.lineWidth = width;
  ctx.beginPath();
  path.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke();

  // arrowhead along the last non-degenerate stretch
  const end = path[path.length - 1];
  let prev = path[path.length - 2];
  for (let i = path.length - 2; i >= 0 && Math.hypot(end.x - prev.x, end.y - prev.y) < 2; i--) prev = path[i];
  const dir = sub(end, prev);
  const n = Math.hypot(dir.x, dir.y);
  if (n > 0.5) {
    const u = { x: dir.x / n, y: dir.y / n };
    const head = width * 1.8;
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = colour;
    polygon(
      ctx,
      [
        { x: end.x + u.x * head * 0.6, y: end.y + u.y * head * 0.6 },
        { x: end.x - u.x * head * 0.6 - u.y * head * 0.6, y: end.y - u.y * head * 0.6 + u.x * head * 0.6 },
        { x: end.x - u.x * head * 0.6 + u.y * head * 0.6, y: end.y - u.y * head * 0.6 - u.x * head * 0.6 },
      ],
      true,
    );
  }
  ctx.restore();
}

/** Numbered markers where each order is given, drawn above the men so they stay readable. */
function drawOrderMarks(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  c: Company,
  tl: ReturnType<Replay['timeline']>,
  pal: Palette,
  d: DrillSystem,
) {
  const segs = tl.segments.get(c.id) ?? [];
  ctx.save();
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  segs.forEach((seg, i) => {
    const p = cam.worldToScreen(lineAnchor(seg.start, d));
    if (seg.error) {
      ctx.strokeStyle = pal.error;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(p.x - 7, p.y - 7);
      ctx.lineTo(p.x + 7, p.y + 7);
      ctx.moveTo(p.x + 7, p.y - 7);
      ctx.lineTo(p.x - 7, p.y + 7);
      ctx.stroke();
      return;
    }
    circle(ctx, p, 8, pal.field, true);
    circle(ctx, p, 8, companyInk(c, pal), false, 1.5);
    ctx.fillStyle = pal.ink;
    ctx.fillText(String(i + 1), p.x, p.y + 0.5);
  });
  ctx.restore();
}

function circle(ctx: CanvasRenderingContext2D, p: Vec2, r: number, colour: string, fill: boolean, lw = 1) {
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = colour;
    ctx.fill();
  } else {
    ctx.strokeStyle = colour;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

function polygon(ctx: CanvasRenderingContext2D, pts: Vec2[], fill: boolean) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  if (fill) ctx.fill();
  else ctx.stroke();
}

function dashedLine(ctx: CanvasRenderingContext2D, a: Vec2, b: Vec2, colour: string, dash: number[], lw: number) {
  ctx.save();
  ctx.setLineDash(dash);
  ctx.strokeStyle = colour;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.restore();
}

/** World bounds of every company's current and ghost formation. */
export function sceneBounds(store: Store) {
  const scene = store.get();
  const d = getDrill(scene.drillId);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const c of scene.companies) {
    for (const s of [scene.current[c.id], scene.ghost[c.id]]) {
      if (!s) continue;
      for (const f of layout(c, s, d)) {
        minX = Math.min(minX, f.pos.x);
        minY = Math.min(minY, f.pos.y);
        maxX = Math.max(maxX, f.pos.x);
        maxY = Math.max(maxY, f.pos.y);
      }
    }
  }
  if (!Number.isFinite(minX)) return { minX: -20, minY: -20, maxX: 20, maxY: 20 };
  return { minX: minX - 5, minY: minY - 5, maxX: maxX + 5, maxY: maxY + 5 };
}
