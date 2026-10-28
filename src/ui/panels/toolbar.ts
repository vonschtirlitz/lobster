import type { Store } from '../../state/store';
import type { DressPoint, FormationState, OrderSpacing } from '../../model/types';
import { getDrill } from '../../drill/registry';
import { resizeAboutDress } from '../../model/formation';
import { exportScene, importScene } from '../../state/persist';
import { h, segmented } from '../dom';

const ORDER_TEXT: Record<OrderSpacing, string> = { close: 'Close', open: 'Open', extended: 'Extended' };

/** Change the order of every selected company's edited formation, holding the dressing point. */
export function applyOrder(store: Store, order: OrderSpacing) {
  const scene = store.get();
  const ui = store.ui();
  const d = getDrill(scene.drillId);
  const changes = ui.selected
    .map((id) => {
      const c = scene.companies.find((x) => x.id === id);
      const s = scene[ui.editTarget][id];
      return c && s ? { id, which: ui.editTarget, state: resizeAboutDress(c, s, order, null, d) } : null;
    })
    .filter((x): x is { id: string; which: 'current' | 'ghost'; state: FormationState } => x !== null);
  if (changes.length) store.dispatch({ type: 'setFormations', changes });
}

export function applyDress(store: Store, dressBy: DressPoint) {
  const scene = store.get();
  const ui = store.ui();
  const changes = ui.selected
    .filter((id) => scene[ui.editTarget][id])
    .map((id) => ({ id, which: ui.editTarget, state: { ...scene[ui.editTarget][id], dressBy } }));
  if (changes.length) store.dispatch({ type: 'setFormations', changes });
}

export function mountToolbar(el: HTMLElement, store: Store, fit: () => void, showError: (msg: string) => void) {
  const fileInput = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    const r = importScene(await file.text());
    if (r.ok) {
      store.dispatch({ type: 'replaceScene', scene: r.scene });
      store.setUi({ selected: r.scene.companies[0] ? [r.scene.companies[0].id] : [] });
      fit();
    } else showError(r.error);
  });

  const save = () => {
    const blob = new Blob([exportScene(store.get())], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: 'lobster-scene.json' });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const render = () => {
    const scene = store.get();
    const ui = store.ui();
    const d = getDrill(scene.drillId);
    const first = ui.selected[0];
    const s = first ? scene[ui.editTarget][first] : undefined;
    const none = !s;

    el.replaceChildren(
      h(
        'h1',
        { title: 'Loud Officers Barking Simple Terms at Exhausted Redcoats' },
        h('img', { src: `${import.meta.env.BASE_URL}favicon.svg`, alt: '', width: 24, height: 24 }),
        'LOBSTER',
      ),
      segmented(
        'Tool',
        [
          { value: 'select', text: 'Select' },
          { value: 'frontage', text: 'Frontage' },
        ],
        ui.tool,
        (tool) => store.setUi({ tool }),
      ),
      segmented(
        'Edit',
        [
          { value: 'current', text: 'Start' },
          { value: 'ghost', text: 'Ghost' },
        ],
        ui.editTarget,
        (editTarget) => store.setUi({ editTarget }),
      ),
      h(
        'button',
        { type: 'button', 'aria-pressed': String(ui.showGhost), on: { click: () => store.setUi({ showGhost: !ui.showGhost }) } },
        ui.showGhost ? 'Hide ghost' : 'Show ghost',
      ),
      segmented(
        'Ghost',
        [
          { value: 'line', text: 'Line' },
          { value: 'column', text: 'Column of platoons' },
        ],
        first ? scene.ghostShape[first] ?? 'line' : null,
        (shape) => ui.selected.forEach((id) => store.dispatch({ type: 'setGhostShape', id, shape })),
        none,
      ),
      segmented(
        d.terms.order ?? 'Order',
        d.defaults.allowedOrders.map((o) => ({ value: o, text: ORDER_TEXT[o] })),
        s?.order ?? null,
        (o) => applyOrder(store, o),
        none,
      ),
      segmented(
        d.terms.dress ?? 'Dress',
        [
          { value: 'right' as DressPoint, text: 'R' },
          { value: 'centre' as DressPoint, text: 'C' },
          { value: 'left' as DressPoint, text: 'L' },
        ],
        s?.dressBy ?? null,
        (p) => applyDress(store, p),
        none,
      ),
      h('button', { type: 'button', on: { click: fit } }, 'Fit'),
      h('button', { type: 'button', on: { click: save } }, 'Save'),
      h('button', { type: 'button', on: { click: () => fileInput.click() } }, 'Load'),
      fileInput,
    );
  };
  store.subscribe(render);
  render();
}
