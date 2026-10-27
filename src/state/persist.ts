import type { Scene, Store } from './store';

const KEY = 'orderplanner.scene.v1';

export const exportScene = (s: Scene): string => JSON.stringify(s, null, 2);

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

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
  const current = raw.current as Record<string, unknown>;
  const ghost = raw.ghost as Record<string, unknown>;
  const orders = raw.orders as Record<string, unknown>;
  const shapes = isObj(raw.ghostShape) ? raw.ghostShape : {};
  for (const c of raw.companies as unknown[]) {
    if (!isObj(c) || typeof c.id !== 'string' || !Array.isArray(c.platoons))
      return { ok: false, error: 'A company in the scene is malformed.' };
    const name = String(c.name ?? c.id);
    if (!isObj(current?.[c.id]) || !Array.isArray((current[c.id] as Record<string, unknown>).blocks))
      return { ok: false, error: `${name} has no starting formation.` };
    if (!isObj(ghost?.[c.id]) || !Array.isArray((ghost[c.id] as Record<string, unknown>).blocks))
      return { ok: false, error: `${name} has no ghost formation.` };
    if (!Array.isArray(orders?.[c.id])) return { ok: false, error: `${name} has no orders list.` };
    shapes[c.id] ??= 'line';
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
