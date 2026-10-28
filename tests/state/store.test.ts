import { createStore, defaultScene } from '../../src/state/store';
import { exportScene, importScene } from '../../src/state/persist';
import { createReplay } from '../../src/state/replay';
import { lineAnchor } from '../../src/model/formation';
import { getDrill } from '../../src/drill/registry';
import type { FormationState, Order } from '../../src/model/types';

const men = (s: FormationState, layoutMen: number[]) => s.blocks.length === layoutMen.length;

describe('store', () => {
  it('undo and redo an added company', () => {
    const store = createStore(defaultScene());
    store.dispatch({ type: 'addCompany' });
    expect(store.get().companies).toHaveLength(2);
    store.undo();
    expect(store.get().companies).toHaveLength(1);
    store.redo();
    expect(store.get().companies).toHaveLength(2);
  });

  it('changing rank and file re-tells the platoons and keeps the line where it stood', () => {
    const store = createStore(defaultScene());
    const id = store.get().companies[0].id;
    const d = getDrill(store.get().drillId);
    const before = lineAnchor(store.get().current[id], d);
    store.dispatch({ type: 'updateCompany', id, patch: { rankAndFile: 60 } });
    const c = store.get().companies[0];
    expect(c.platoons.reduce((n, p) => n + p.men, 0)).toBe(60);
    const s = store.get().current[id];
    expect(men(s, [30, 30])).toBe(true);
    expect(s.blocks.reduce((n, b) => n + b.files * b.ranks, 0)).toBe(60);
    const after = lineAnchor(s, d);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it('adoptEndAsStart sets current and clears the orders', () => {
    const store = createStore(defaultScene());
    const id = store.get().companies[0].id;
    const order: Order = { id: 'o1', kind: 'march', params: { paces: 5, step: 'ordinary' } };
    store.dispatch({ type: 'addOrder', id, order });
    const end = store.get().ghost[id];
    store.dispatch({ type: 'adoptEndAsStart', id, end });
    expect(store.get().current[id]).toEqual(end);
    expect(store.get().orders[id]).toEqual([]);
  });
});

describe('persist', () => {
  it('export → import round-trips', () => {
    const s = defaultScene();
    const r = importScene(exportScene(s));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.scene).toEqual(s);
  });

  it('import rejects bad file', () => {
    const store = createStore(defaultScene());
    const before = store.get();
    for (const bad of ['{}', 'not json', JSON.stringify({ ...defaultScene(), version: 0 })]) {
      const r = importScene(bad);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.length).toBeGreaterThan(0);
    }
    expect(store.get()).toBe(before);
  });

  it('import rejects a version-1 file with malformed contents', () => {
    const good = defaultScene();
    const id = good.companies[0].id;
    const variants: ((s: any) => void)[] = [
      (s) => delete s.companies[0].officers,
      (s) => delete s.current[id].blocks[0].anchor,
      (s) => (s.orders[id] = [null]),
      (s) => (s.ghost[id].order = 'loose'),
      (s) => (s.current[id].dressBy = 'sideways'),
      (s) => (s.companies[0].platoons[0].men = 'many'),
      (s) => (s.settings.tolerancePaces = 'x'),
    ];
    for (const mutate of variants) {
      const s = JSON.parse(exportScene(good));
      mutate(s);
      const r = importScene(JSON.stringify(s));
      expect(r.ok, mutate.toString()).toBe(false);
    }
  });
});

describe('replay', () => {
  it('playhead clamps on recompute', () => {
    const store = createStore(defaultScene());
    const id = store.get().companies[0].id;
    const march = (paces: number): Order => ({ id: `m${paces}`, kind: 'march', params: { paces, step: 'ordinary' } });
    store.dispatch({ type: 'setOrders', id, orders: [march(40)] });
    const replay = createReplay(store, () => 0);
    replay.seek(30);
    expect(replay.t()).toBeCloseTo(30);
    store.dispatch({ type: 'setOrders', id, orders: [march(5)] });
    expect(replay.t()).toBeCloseTo(5);
  });
});

describe('import error wording', () => {
  it('tells the user what to do next in plain words', () => {
    for (const bad of ['not json', '{}', JSON.stringify({ ...defaultScene(), version: 0 })]) {
      const r = importScene(bad);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error).toMatch(/Save button/);
        expect(r.error).not.toMatch(/malformed|JSON|must be a list/);
      }
    }
  });
});
