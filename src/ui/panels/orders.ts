import type { Store } from '../../state/store';
import type { Replay } from '../../state/replay';
import type { Order } from '../../model/types';
import type { CommandDef, DrillSystem } from '../../drill/types';
import { getDrill } from '../../drill/registry';
import { endState } from '../../engine/execute';
import { compareToGhost } from '../../engine/compare';
import { PLAN_UNAVAILABLE } from '../../engine/plan';
import { param } from '../../engine/primitives';
import { newId } from '../../state/store';
import { h, numberInput } from '../dom';

export function wordsFor(order: Order, d: DrillSystem): string {
  const def = d.commands.find((c) => c.kind === order.kind);
  if (!def) return order.kind;
  const filled = Object.fromEntries(def.params.map((p) => [p.key, param(order, p.key, d)]));
  return def.say ? def.say(filled) : def.words;
}

const defaults = (def: CommandDef) => Object.fromEntries(def.params.map((p) => [p.key, p.default]));

export function mountOrders(el: HTMLElement, store: Store, replay: Replay) {
  let insertAt: number | null = null;
  let dragFrom: number | null = null;
  let rows: HTMLElement[] = [];
  let lastScene = store.get();
  let lastSelected = '';

  const highlight = () => {
    const id = store.ui().selected[0];
    const segs = id ? replay.timeline().segments.get(id) ?? [] : [];
    const t = replay.t();
    rows.forEach((row, i) => {
      const s = segs[i];
      row.classList.toggle('current', !!s && !s.error && (replay.playing() || t > 0) && t >= s.t0 && t < s.t1);
    });
  };

  const render = () => {
    const scene = store.get();
    const ui = store.ui();
    const d = getDrill(scene.drillId);
    rows = [];

    if (ui.selected.length !== 1) {
      el.replaceChildren(h('h2', {}, 'Orders'), h('p', { style: 'color:var(--muted)' }, ui.selected.length ? 'Select one company to give it orders.' : 'Select a company to give it orders.'));
      return;
    }
    const id = ui.selected[0];
    const c = scene.companies.find((x) => x.id === id);
    if (!c) return;
    const orders = scene.orders[id] ?? [];
    const tl = replay.timeline();
    const segs = tl.segments.get(id) ?? [];
    const firstError = segs.findIndex((s) => s.error);

    const addOrder = (def: CommandDef) => {
      const order: Order = { id: newId(), kind: def.kind, params: defaults(def) };
      store.dispatch({ type: 'addOrder', id, order, index: insertAt ?? undefined });
      insertAt = null;
    };

    const paramControl = (o: Order, def: CommandDef) =>
      def.params.map((p) => {
        const v = param(o, p.key, d);
        const set = (val: unknown) => store.dispatch({ type: 'updateOrder', id, orderId: o.id, params: { [p.key]: val } });
        const control =
          p.type === 'number'
            ? numberInput(Number(v), set, { min: p.min, max: p.max, step: p.key === 'seconds' ? 0.5 : 1, label: p.label })
            : h(
                'select',
                { 'aria-label': p.label, on: { change: (e) => set((e.target as HTMLSelectElement).value) } },
                ...(p.choices ?? []).map((ch) => h('option', { value: ch, selected: ch === String(v) }, ch)),
              );
        return h('label', { style: 'display:inline-flex;gap:4px;align-items:center' }, p.label, control);
      });

    const list = h(
      'ol',
      { class: 'orders', 'aria-label': `Orders for ${c.name}` },
      ...orders.map((o, i) => {
        const def = d.commands.find((x) => x.kind === o.kind);
        const seg = segs[i];
        const state = seg?.error ? 'error' : firstError >= 0 && i > firstError ? 'unreached' : '';
        const row = h(
          'li',
          {
            class: state,
            draggable: 'true',
            on: {
              dragstart: () => (dragFrom = i),
              dragover: (e) => e.preventDefault(),
              drop: (e) => {
                e.preventDefault();
                if (dragFrom !== null && dragFrom !== i) store.dispatch({ type: 'moveOrder', id, from: dragFrom, to: i });
                dragFrom = null;
              },
            },
          },
          h('span', { class: 'handle', title: 'Drag to reorder', 'aria-hidden': 'true' }, '⋮⋮'),
          h('span', { class: 'num' }, `${i + 1}.`),
          h(
            'div',
            {},
            h(
              'div',
              {
                class: 'words',
                role: 'button',
                tabindex: 0,
                title: 'Show the company as this word is given',
                on: {
                  click: () => {
                    replay.pause();
                    if (seg) replay.seek(seg.t0);
                  },
                },
              },
              wordsFor(o, d),
            ),
            def ? h('div', { class: 'params' }, ...paramControl(o, def)) : null,
            seg?.error ? h('div', { class: 'reason' }, seg.error) : state === 'unreached' ? h('div', { class: 'reason' }, 'Not reached') : null,
          ),
          h(
            'div',
            { class: 'actions' },
            h('button', { type: 'button', title: 'Insert an order after this one', 'aria-label': `Insert after order ${i + 1}`, on: { click: () => ((insertAt = i + 1), render()) } }, '+'),
            h('button', { type: 'button', title: 'Remove this order', 'aria-label': `Remove order ${i + 1}`, on: { click: () => store.dispatch({ type: 'removeOrder', id, orderId: o.id }) } }, '×'),
          ),
        );
        rows.push(row);
        return row;
      }),
    );

    const end = endState(tl, id);
    const ghost = scene.ghost[id];
    const cmp = end && ghost ? compareToGhost(c, end, ghost, d, { paces: scene.settings.tolerancePaces, degrees: scene.settings.toleranceDeg }) : null;

    el.replaceChildren(
      ...[
      h('h2', {}, `Orders: ${c.name}`),
      orders.length ? list : h('p', { style: 'color:var(--muted)' }, 'No orders yet. Add the words of command below.'),
      h(
        'div',
        {},
        insertAt !== null
          ? h('div', { class: 'row', style: 'font-size:12px;color:var(--muted)' }, `Inserting after order ${insertAt}`, h('button', { type: 'button', on: { click: () => ((insertAt = null), render()) } }, 'Cancel'))
          : null,
        h('div', { class: 'menu', role: 'group', 'aria-label': 'Add a command' }, ...d.commands.map((def) => h('button', { type: 'button', on: { click: () => addOrder(def) } }, `+ ${def.words}`))),
      ),
      cmp
        ? h(
            'div',
            { class: 'compare', role: 'status' },
            h('div', {}, h('span', { class: `verdict ${cmp.pass ? 'ok' : 'no'}` }, cmp.pass ? '✓ On the ghost' : '✗ Not on the ghost')),
            h(
              'div',
              {},
              `${cmp.distance.toFixed(1)} paces off · front ${cmp.frontDeg.toFixed(0)}° · ` + (cmp.mismatches.length ? cmp.mismatches.join(' · ') : 'shape ✓'),
            ),
            h(
              'div',
              { class: 'row', style: 'font-size:12px' },
              'Tolerance',
              numberInput(scene.settings.tolerancePaces, (n) => store.dispatch({ type: 'setSettings', patch: { tolerancePaces: Math.max(0, n) } }), { min: 0, step: 0.5, label: 'Tolerance in paces' }),
              'paces',
              numberInput(scene.settings.toleranceDeg, (n) => store.dispatch({ type: 'setSettings', patch: { toleranceDeg: Math.max(0, n) } }), { min: 0, label: 'Tolerance in degrees' }),
              '°',
            ),
          )
        : null,
      h(
        'div',
        { class: 'row', style: 'margin-top:10px' },
        h(
          'button',
          {
            type: 'button',
            disabled: !orders.length || !end,
            on: {
              click: () => {
                if (!end) return;
                store.dispatch({ type: 'adoptEndAsStart', id, end });
                replay.seek(0);
              },
            },
          },
          'Make this the start',
        ),
        h('button', { type: 'button', disabled: true, title: PLAN_UNAVAILABLE }, 'Suggest orders'),
      ),
      ].filter((x): x is NonNullable<typeof x> => x !== null),
    );
    highlight();
  };

  store.subscribe(() => {
    const scene = store.get();
    const sel = store.ui().selected.join(',');
    if (scene !== lastScene || sel !== lastSelected) {
      lastScene = scene;
      lastSelected = sel;
      render();
    }
  });
  replay.subscribe(highlight);
  render();
}
