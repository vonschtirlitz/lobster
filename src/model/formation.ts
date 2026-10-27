import type { DrillSystem } from '../drill/types';
import type { Block, Company, DressPoint, FormationState, OrderSpacing, Vec2 } from './types';
import { blockWidth, blocksInLine, flankPos } from './layout';
import { filesFor, platoonTotal } from './telloff';
import { add, angleDiff, dist, fwd, lerp, right, rotateAbout, scale, sub } from './vec';

const TOL = 0.05;

export const companyFront = (s: FormationState): number => s.blocks[0]?.front ?? Math.PI / 2;
export const companyRanks = (s: FormationState): number => Math.max(1, ...s.blocks.map((b) => b.ranks));

/** Blocks with men in them. */
const occupied = (s: FormationState) => s.blocks.filter((b) => b.files > 0);

export function asLine(
  c: Company,
  anchor: Vec2,
  front: number,
  ranks: number,
  order: OrderSpacing,
  dressBy: DressPoint,
  d: DrillSystem,
): FormationState {
  const fi = d.defaults.fileInterval[order];
  const files = c.platoons.map((p) => filesFor(p.men, ranks));
  const total = files.reduce((a, b) => a + b, 0);
  const r = right(front);
  let start = 0;
  const blocks: Block[] = c.platoons.map((p, i) => {
    const mid = start + (files[i] - 1) / 2;
    start += files[i];
    const across = ((total - 1) / 2 - mid) * fi;
    return { platoonId: p.id, anchor: add(anchor, scale(r, across)), front, files: files[i], ranks };
  });
  return { blocks, menFacing: 'front', order, dressBy };
}

/** Open column at full distance: each platoon stands its own frontage behind the one before. */
export function asColumnOfPlatoons(
  c: Company,
  headAnchor: Vec2,
  front: number,
  ranks: number,
  order: OrderSpacing,
  dressBy: DressPoint,
  d: DrillSystem,
): FormationState {
  const fi = d.defaults.fileInterval[order];
  const files = c.platoons.map((p) => filesFor(p.men, ranks));
  const r = right(front);
  const back = fwd(front);
  const w = (n: number) => Math.max(0, n - 1) * fi;
  const align = (n: number) => (dressBy === 'right' ? -w(n) / 2 : dressBy === 'left' ? w(n) / 2 : 0);
  const head = files[0] ?? 0;
  let behind = 0;
  const blocks: Block[] = c.platoons.map((p, i) => {
    if (i > 0) behind += w(files[i - 1]) + fi;
    const lateral = align(files[i]) - align(head);
    const anchor = add(add(headAnchor, scale(back, -behind)), scale(r, lateral));
    return { platoonId: p.id, anchor, front, files: files[i], ranks };
  });
  return { blocks, menFacing: 'front', order, dressBy };
}

function isColumn(s: FormationState, fi: number): boolean {
  const bs = occupied(s);
  if (bs.length < 2) return false;
  const f0 = bs[0].front;
  if (bs.some((b) => Math.abs(angleDiff(b.front, f0)) > (0.5 * Math.PI) / 180)) return false;
  const f = fwd(f0);
  const r = right(f0);
  const proj = (v: Vec2, u: Vec2) => v.x * u.x + v.y * u.y;
  for (let i = 1; i < bs.length; i++) {
    const gap = proj(sub(bs[i - 1].anchor, bs[i].anchor), f);
    if (Math.abs(gap - (blockWidth(bs[i - 1], fi) + fi)) > TOL) return false;
  }
  const aligned = (side: 'right' | 'left') => {
    const x0 = proj(flankPos(bs[0], side, fi), r);
    return bs.every((b) => Math.abs(proj(flankPos(b, side, fi), r) - x0) <= TOL);
  };
  const centred = () => {
    const x0 = proj(bs[0].anchor, r);
    return bs.every((b) => Math.abs(proj(b.anchor, r) - x0) <= TOL);
  };
  return aligned('right') || aligned('left') || centred();
}

function isLine(s: FormationState, fi: number): boolean {
  const bs = occupied(s);
  if (bs.length === 0 || !blocksInLine({ ...s, blocks: bs }, TOL)) return false;
  for (let i = 1; i < bs.length; i++) {
    if (Math.abs(dist(flankPos(bs[i - 1], 'left', fi), flankPos(bs[i], 'right', fi)) - fi) > TOL) return false;
  }
  return true;
}

export function describe(s: FormationState, d: DrillSystem): 'line' | 'column' | 'irregular' {
  const fi = d.defaults.fileInterval[s.order];
  if (isLine(s, fi)) return 'line';
  if (isColumn(s, fi)) return 'column';
  return 'irregular';
}

function guideOf(first: Block, last: Block, dress: DressPoint, fi: number): Vec2 {
  const r = flankPos(first, 'right', fi);
  const l = flankPos(last, 'left', fi);
  return dress === 'right' ? r : dress === 'left' ? l : lerp(r, l, 0.5);
}

/** The directing file's front-rank position (line), or block 0's (column / irregular). */
export function guidePoint(_c: Company, s: FormationState, d: DrillSystem): Vec2 {
  const bs = occupied(s);
  if (bs.length === 0) return s.blocks[0]?.anchor ?? { x: 0, y: 0 };
  const fi = d.defaults.fileInterval[s.order];
  if (isLine(s, fi)) return guideOf(bs[0], bs[bs.length - 1], s.dressBy, fi);
  return guideOf(bs[0], bs[0], s.dressBy, fi);
}

/** Centre of the front rank for a line; block 0's anchor otherwise. */
export function lineAnchor(s: FormationState, d: DrillSystem): Vec2 {
  const bs = occupied(s);
  if (bs.length === 0) return s.blocks[0]?.anchor ?? { x: 0, y: 0 };
  const fi = d.defaults.fileInterval[s.order];
  if (!isLine(s, fi)) return bs[0].anchor;
  return lerp(flankPos(bs[0], 'right', fi), flankPos(bs[bs.length - 1], 'left', fi), 0.5);
}

function snapRanks(raw: number, allowed: number[]): number {
  return allowed.reduce((best, r) =>
    Math.abs(r - raw) < Math.abs(best - raw) || (Math.abs(r - raw) === Math.abs(best - raw) && r > best) ? r : best,
  );
}

export function frontageFromDrag(
  c: Company,
  a: Vec2,
  b: Vec2,
  current: FormationState,
  d: DrillSystem,
): { state: FormationState; files: number; ranks: number; note?: string } {
  const fi = d.defaults.fileInterval[current.order];
  const men = Math.max(1, platoonTotal(c));
  const span = sub(b, a);
  const front = Math.atan2(span.y, span.x) + Math.PI / 2;
  const wanted = Math.min(men, Math.max(1, Math.floor(dist(a, b) / fi) + 1));
  const raw = Math.ceil(men / wanted);
  const ranks = snapRanks(raw, d.defaults.allowedRanks);
  const state = asLine(c, lerp(a, b, 0.5), front, ranks, current.order, current.dressBy, d);
  const files = state.blocks.reduce((n, bl) => n + bl.files, 0);
  const note = ranks !== raw ? `${raw} ranks is not allowed; formed ${ranks} ranks` : undefined;
  return { state, files, ranks, note };
}

/** Re-form with a new order and/or depth, holding the dressing point still. */
export function resizeAboutDress(
  c: Company,
  s: FormationState,
  newOrder: OrderSpacing | null,
  newRanks: number | null,
  d: DrillSystem,
): FormationState {
  const order = newOrder ?? s.order;
  const ranks = newRanks ?? companyRanks(s);
  const fiOld = d.defaults.fileInterval[s.order];
  const fiNew = d.defaults.fileInterval[order];

  if (isLine(s, fiOld) || occupied(s).length === 0) {
    const held = guidePoint(c, s, d);
    const built = asLine(c, { x: 0, y: 0 }, companyFront(s), ranks, order, s.dressBy, d);
    const moved = translateState(built, sub(held, guidePoint(c, built, d)));
    return { ...moved, menFacing: s.menFacing };
  }

  const blocks = s.blocks.map((b) => {
    const p = c.platoons.find((x) => x.id === b.platoonId);
    const files = filesFor(p?.men ?? 0, ranks);
    const held = guideOf(b, b, s.dressBy, fiOld);
    const nb: Block = { ...b, files, ranks, anchor: { x: 0, y: 0 } };
    const now = guideOf(nb, nb, s.dressBy, fiNew);
    return { ...nb, anchor: sub(held, now) };
  });
  return { ...s, blocks, order };
}

export const translateState = (s: FormationState, v: Vec2): FormationState => ({
  ...s,
  blocks: s.blocks.map((b) => ({ ...b, anchor: add(b.anchor, v) })),
});

export const rotateState = (s: FormationState, pivot: Vec2, theta: number): FormationState => ({
  ...s,
  blocks: s.blocks.map((b) => ({ ...b, anchor: rotateAbout(b.anchor, pivot, theta), front: b.front + theta })),
});
