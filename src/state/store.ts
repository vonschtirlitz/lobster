import type { Company, FormationState, Order, Platoon } from '../model/types';
import type { DrillSystem } from '../drill/types';
import { getDrill } from '../drill/registry';
import { asColumnOfPlatoons, asLine, companyFront, companyRanks, describe, lineAnchor, translateState } from '../model/formation';
import { layout } from '../model/layout';
import { splitMen } from '../model/telloff';

export type GhostShape = 'line' | 'column';

export interface Scene {
  version: 1;
  drillId: string;
  companies: Company[];
  current: Record<string, FormationState>;
  ghost: Record<string, FormationState>;
  ghostShape: Record<string, GhostShape>;
  orders: Record<string, Order[]>;
  settings: { tolerancePaces: number; toleranceDeg: number };
}

export interface UiState {
  selected: string[];
  editTarget: 'current' | 'ghost';
  tool: 'select' | 'frontage';
  showGhost: boolean;
}

export type Action =
  | { type: 'addCompany' }
  | { type: 'removeCompany'; id: string }
  | { type: 'updateCompany'; id: string; patch: Partial<Omit<Company, 'id'>> }
  | { type: 'setPlatoons'; id: string; platoons: Platoon[] }
  | { type: 'setFormation'; id: string; which: 'current' | 'ghost'; state: FormationState }
  | { type: 'setFormations'; changes: { id: string; which: 'current' | 'ghost'; state: FormationState }[] }
  | { type: 'setGhostShape'; id: string; shape: GhostShape }
  | { type: 'setOrders'; id: string; orders: Order[] }
  | { type: 'addOrder'; id: string; order: Order; index?: number }
  | { type: 'updateOrder'; id: string; orderId: string; params: Record<string, unknown> }
  | { type: 'moveOrder'; id: string; from: number; to: number }
  | { type: 'removeOrder'; id: string; orderId: string }
  | { type: 'adoptEndAsStart'; id: string; end: FormationState }
  | { type: 'setSettings'; patch: Partial<Scene['settings']> }
  | { type: 'replaceScene'; scene: Scene };

const UNDO_LIMIT = 200;
const COLOURS = ['#b03a2e', '#1f618d', '#7d6608', '#196f3d', '#6c3483', '#a04000'];
const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];

export const newId = () => Math.random().toString(36).slice(2, 10);

function makeCompany(index: number, d: DrillSystem): Company {
  const count = d.defaults.platoonsPerCompany;
  return {
    id: newId(),
    name: `${ORDINALS[index] ?? `${index + 1}th`} Company`,
    rankAndFile: 40,
    platoons: splitMen(40, count).map((men, i) => ({ id: newId(), name: `${ORDINALS[i]} Platoon`, men })),
    officers: { captain: true, lieutenant: true, ensign: true },
    ncos: { sergeants: 2, corporals: 2, drummer: true },
    colour: COLOURS[index % COLOURS.length],
  };
}

export function defaultScene(drillId = 'gb-1764'): Scene {
  const d = getDrill(drillId);
  const c = makeCompany(0, d);
  const current = asLine(c, { x: 0, y: 0 }, Math.PI / 2, d.defaults.ranks, 'close', d.defaults.defaultDress, d);
  return {
    version: 1,
    drillId: d.id,
    companies: [c],
    current: { [c.id]: current },
    ghost: { [c.id]: translateState(current, { x: 0, y: 30 }) },
    ghostShape: { [c.id]: 'line' },
    orders: { [c.id]: [] },
    settings: { tolerancePaces: 2, toleranceDeg: 5 },
  };
}

/** Rebuild a formation for changed company details, keeping where it stands and how it faces. */
export function rederive(c: Company, s: FormationState, shape: GhostShape | 'auto', d: DrillSystem): FormationState {
  const asColumn = shape === 'column' || (shape === 'auto' && describe(s, d) === 'column');
  const front = companyFront(s);
  const ranks = companyRanks(s);
  const built = asColumn
    ? asColumnOfPlatoons(c, s.blocks[0]?.anchor ?? { x: 0, y: 0 }, front, ranks, s.order, s.dressBy, d)
    : asLine(c, lineAnchor(s, d), front, ranks, s.order, s.dressBy, d);
  return { ...built, menFacing: s.menFacing };
}

function leftmostX(scene: Scene, d: DrillSystem): number {
  let min = Infinity;
  for (const c of scene.companies) for (const f of layout(c, scene.current[c.id], d)) min = Math.min(min, f.pos.x);
  return Number.isFinite(min) ? min : 0;
}

const mapOrders = (s: Scene, id: string, fn: (o: Order[]) => Order[]): Scene => ({
  ...s,
  orders: { ...s.orders, [id]: fn(s.orders[id] ?? []) },
});

function omit<T>(rec: Record<string, T>, id: string): Record<string, T> {
  const { [id]: _drop, ...rest } = rec;
  return rest;
}

export function reduce(s: Scene, a: Action): Scene {
  const d = getDrill(s.drillId);
  switch (a.type) {
    case 'addCompany': {
      const c = makeCompany(s.companies.length, d);
      const probe = asLine(c, { x: 0, y: 0 }, Math.PI / 2, d.defaults.ranks, 'close', d.defaults.defaultDress, d);
      const halfWidth = Math.max(0, ...layout(c, probe, d).map((f) => f.pos.x));
      const current = translateState(probe, { x: leftmostX(s, d) - 10 - halfWidth, y: 0 });
      return {
        ...s,
        companies: [...s.companies, c],
        current: { ...s.current, [c.id]: current },
        ghost: { ...s.ghost, [c.id]: translateState(current, { x: 0, y: 30 }) },
        ghostShape: { ...s.ghostShape, [c.id]: 'line' },
        orders: { ...s.orders, [c.id]: [] },
      };
    }
    case 'removeCompany':
      return {
        ...s,
        companies: s.companies.filter((c) => c.id !== a.id),
        current: omit(s.current, a.id),
        ghost: omit(s.ghost, a.id),
        ghostShape: omit(s.ghostShape, a.id),
        orders: omit(s.orders, a.id),
      };
    case 'setPlatoons':
      return reduce(s, { type: 'updateCompany', id: a.id, patch: { platoons: a.platoons } });
    case 'updateCompany': {
      const old = s.companies.find((c) => c.id === a.id);
      if (!old) return s;
      const c: Company = { ...old, ...a.patch };
      if (a.patch.rankAndFile !== undefined && !a.patch.platoons) {
        const split = splitMen(c.rankAndFile, c.platoons.length);
        c.platoons = c.platoons.map((p, i) => ({ ...p, men: split[i] }));
      }
      const relayout = a.patch.platoons !== undefined || a.patch.rankAndFile !== undefined;
      if (!relayout) return { ...s, companies: s.companies.map((x) => (x.id === a.id ? c : x)) };
      return {
        ...s,
        companies: s.companies.map((x) => (x.id === a.id ? c : x)),
        current: { ...s.current, [a.id]: rederive(c, s.current[a.id], 'auto', d) },
        ghost: { ...s.ghost, [a.id]: rederive(c, s.ghost[a.id], s.ghostShape[a.id] ?? 'line', d) },
      };
    }
    case 'setFormation':
      return { ...s, [a.which]: { ...s[a.which], [a.id]: a.state } };
    case 'setFormations':
      return a.changes.reduce<Scene>((acc, ch) => ({ ...acc, [ch.which]: { ...acc[ch.which], [ch.id]: ch.state } }), s);
    case 'setGhostShape': {
      const c = s.companies.find((x) => x.id === a.id);
      if (!c) return s;
      return {
        ...s,
        ghostShape: { ...s.ghostShape, [a.id]: a.shape },
        ghost: { ...s.ghost, [a.id]: rederive(c, s.ghost[a.id], a.shape, d) },
      };
    }
    case 'setOrders':
      return mapOrders(s, a.id, () => a.orders);
    case 'addOrder':
      return mapOrders(s, a.id, (os) => {
        const i = a.index ?? os.length;
        return [...os.slice(0, i), a.order, ...os.slice(i)];
      });
    case 'updateOrder':
      return mapOrders(s, a.id, (os) => os.map((o) => (o.id === a.orderId ? { ...o, params: { ...o.params, ...a.params } } : o)));
    case 'moveOrder':
      return mapOrders(s, a.id, (os) => {
        const next = [...os];
        const [moved] = next.splice(a.from, 1);
        if (moved) next.splice(Math.max(0, Math.min(next.length, a.to)), 0, moved);
        return next;
      });
    case 'removeOrder':
      return mapOrders(s, a.id, (os) => os.filter((o) => o.id !== a.orderId));
    case 'adoptEndAsStart':
      return { ...s, current: { ...s.current, [a.id]: a.end }, orders: { ...s.orders, [a.id]: [] } };
    case 'setSettings':
      return { ...s, settings: { ...s.settings, ...a.patch } };
    case 'replaceScene':
      return a.scene;
  }
}

export interface Store {
  get(): Scene;
  ui(): UiState;
  dispatch(a: Action): void;
  setUi(p: Partial<UiState>): void;
  undo(): void;
  redo(): void;
  subscribe(fn: () => void): () => void;
}

export function createStore(initial: Scene = defaultScene()): Store {
  let scene = initial;
  let ui: UiState = { selected: initial.companies[0] ? [initial.companies[0].id] : [], editTarget: 'ghost', tool: 'select', showGhost: true };
  const past: Scene[] = [];
  const future: Scene[] = [];
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((fn) => fn());
  const pruneSelection = () => {
    const ids = new Set(scene.companies.map((c) => c.id));
    ui = { ...ui, selected: ui.selected.filter((id) => ids.has(id)) };
  };

  return {
    get: () => scene,
    ui: () => ui,
    dispatch(a) {
      const next = reduce(scene, a);
      if (next === scene) return;
      past.push(scene);
      if (past.length > UNDO_LIMIT) past.shift();
      future.length = 0;
      scene = next;
      pruneSelection();
      notify();
    },
    setUi(p) {
      ui = { ...ui, ...p };
      notify();
    },
    undo() {
      const prev = past.pop();
      if (!prev) return;
      future.push(scene);
      scene = prev;
      pruneSelection();
      notify();
    },
    redo() {
      const next = future.pop();
      if (!next) return;
      past.push(scene);
      scene = next;
      pruneSelection();
      notify();
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
