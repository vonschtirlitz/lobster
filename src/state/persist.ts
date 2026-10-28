import type { Scene, Store } from './store';

const KEY = 'orderplanner.scene.v1';

export const exportScene = (s: Scene): string => JSON.stringify(s, null, 2);

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const ORDERS = ['close', 'open', 'extended'];
const DRESS = ['right', 'left', 'centre'];
const FACINGS = ['front', 'right', 'left', 'about'];

function companyProblem(c: unknown): string | null {
  if (!isObj(c) || typeof c.id !== 'string' || typeof c.name !== 'string') return 'A company in the scene is malformed.';
  const name = c.name;
  if (!num(c.rankAndFile) || typeof c.colour !== 'string') return `${name} is malformed.`;
  if (!Array.isArray(c.platoons) || !c.platoons.every((p) => isObj(p) && typeof p.id === 'string' && typeof p.name === 'string' && num(p.men) && p.men >= 0))
    return `${name} has malformed platoons.`;
  const o = c.officers;
  if (!isObj(o) || !['captain', 'lieutenant', 'ensign'].every((k) => typeof o[k] === 'boolean')) return `${name} has malformed officers.`;
  const n = c.ncos;
  if (!isObj(n) || !num(n.sergeants) || !num(n.corporals) || typeof n.drummer !== 'boolean') return `${name} has malformed NCOs.`;
  return null;
}

function formationProblem(s: unknown): string | null {
  if (!isObj(s) || !Array.isArray(s.blocks)) return 'is missing';
  if (!ORDERS.includes(s.order as string)) return `has an unknown order "${String(s.order)}"`;
  if (!DRESS.includes(s.dressBy as string)) return `has an unknown dressing point "${String(s.dressBy)}"`;
  if (!FACINGS.includes(s.menFacing as string)) return 'has an unknown facing';
  const ok = s.blocks.every(
    (b) =>
      isObj(b) && typeof b.platoonId === 'string' && isObj(b.anchor) && num(b.anchor.x) && num(b.anchor.y) &&
      num(b.front) && num(b.files) && b.files >= 0 && num(b.ranks) && b.ranks >= 1,
  );
  return ok ? null : 'has a malformed block';
}

export function importScene(json: string): { ok: true; scene: Scene } | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: 'This file is not valid JSON.' };
  }
  if (!isObj(raw)) return { ok: false, error: 'This file is not an order planner scene.' };
  if (raw.version !== 1) return { ok: false, error: `Unsupported scene version: ${String(raw.version)}.` };
  for (const k of ['drillId', 'companies', 'current', 'ghost', 'orders', 'settings']) {
    if (!(k in raw)) return { ok: false, error: `The scene is missing "${k}".` };
  }
  if (!Array.isArray(raw.companies)) return { ok: false, error: '"companies" must be a list.' };
  if (typeof raw.drillId !== 'string') return { ok: false, error: '"drillId" must be text.' };
  const settings = raw.settings as Record<string, unknown>;
  if (!isObj(settings) || !num(settings.tolerancePaces) || !num(settings.toleranceDeg))
    return { ok: false, error: 'The scene\'s tolerance settings are malformed.' };
  const current = raw.current as Record<string, unknown>;
  const ghost = raw.ghost as Record<string, unknown>;
  const orders = raw.orders as Record<string, unknown>;
  if (!isObj(current) || !isObj(ghost) || !isObj(orders)) return { ok: false, error: 'The scene\'s formations or orders are malformed.' };
  const shapes = isObj(raw.ghostShape) ? raw.ghostShape : {};
  for (const c of raw.companies as unknown[]) {
    const problem = companyProblem(c);
    if (problem) return { ok: false, error: problem };
    const co = c as Record<string, unknown>;
    const id = co.id as string;
    const name = String(co.name);
    for (const [label, s] of [['starting', current[id]], ['ghost', ghost[id]]] as const) {
      const fp = formationProblem(s);
      if (fp) return { ok: false, error: `${name}: the ${label} formation ${fp}.` };
    }
    const list = orders[id];
    if (!Array.isArray(list)) return { ok: false, error: `${name} has no orders list.` };
    if (!list.every((o) => isObj(o) && typeof o.id === 'string' && typeof o.kind === 'string' && isObj(o.params)))
      return { ok: false, error: `${name} has a malformed order.` };
    if (shapes[id] !== 'line' && shapes[id] !== 'column') shapes[id] = 'line';
  }
  return { ok: true, scene: { ...(raw as unknown as Scene), ghostShape: shapes as Scene['ghostShape'] } };
}

type KV = Pick<Storage, 'getItem' | 'setItem'>;

export function autosave(store: Store, storage: KV | undefined = globalThis.localStorage, delay = 500): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return store.subscribe(() => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        storage?.setItem(KEY, exportScene(store.get()));
      } catch {
        // storage full or blocked: autosave is a convenience only
      }
    }, delay);
  });
}

export function loadAutosave(storage: KV | undefined = globalThis.localStorage): Scene | null {
  try {
    const json = storage?.getItem(KEY);
    if (!json) return null;
    const r = importScene(json);
    return r.ok ? r.scene : null;
  } catch {
    return null;
  }
}
